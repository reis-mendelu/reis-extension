/**
 * Google OAuth (Authorization Code + PKCE) for the extension.
 *
 * Phase 0 plumbing. The Google `client_secret` lives ONLY in the google-oauth
 * Supabase Edge Function — this module never sees it. We use launchWebAuthFlow
 * (cross-browser) + PKCE, exchange the code through the proxy, and keep the
 * resulting tokens in chrome.storage.local on the user's own device.
 *
 * Scope is deliberately `drive.file` only: non-sensitive, no Google verification,
 * and sufficient for both Drive uploads and the Docs API on app-created files.
 */

const SUPABASE_URL = 'https://zvbpgkmnrqyprtkyxkwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YnBna21ucnF5cHJ0a3l4a3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDU5NjYsImV4cCI6MjA4NDMyMTk2Nn0.8eaGOhlZHUf9uOlb6vL_P5D61bILFdgSu245kaIhMvQ';
const OAUTH_PROXY = `${SUPABASE_URL}/functions/v1/google-oauth`;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const TOKEN_KEY = 'reis_google_tokens';
const EXPIRY_BUFFER_MS = 60_000; // refresh 60s before actual expiry

export interface GoogleTokens {
    access_token: string;
    refresh_token: string;
    expiry: number; // epoch ms when access_token expires
    scope?: string;
}

// --- PKCE helpers ---------------------------------------------------------

function base64Url(bytes: Uint8Array): string {
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
}

async function challengeFromVerifier(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
}

/**
 * Ask the background SW for the redirect URI Google must have registered.
 * Routed through the SW because `chrome.identity` is not exposed to the iframe.
 */
export async function getRedirectURL(): Promise<string> {
    const res = await chrome.runtime.sendMessage({ type: 'GOOGLE_GET_REDIRECT_URL' });
    if (!res?.success || !res.url) {
        throw new Error(res?.error || 'Could not get redirect URL from background SW.');
    }
    return res.url as string;
}

/** Diagnostic: does this browser's background SW expose chrome.identity? */
export async function identityDiag(): Promise<{ hasIdentity: boolean; hasLaunch: boolean }> {
    return await chrome.runtime.sendMessage({ type: 'GOOGLE_IDENTITY_DIAG' });
}

// --- proxy + storage ------------------------------------------------------

async function callProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(OAUTH_PROXY, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
        throw new Error(data.error_description || data.error || `OAuth proxy error: ${res.status}`);
    }
    return data;
}

async function readTokens(): Promise<GoogleTokens | null> {
    // chrome.storage is torn down in an invalidated content-script context
    // (extension reloaded but the page wasn't). Fail soft instead of throwing.
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    const res = await chrome.storage.local.get(TOKEN_KEY);
    return (res[TOKEN_KEY] as GoogleTokens) ?? null;
}

async function writeTokens(tokens: GoogleTokens): Promise<void> {
    await chrome.storage.local.set({ [TOKEN_KEY]: tokens });
}

// --- public API -----------------------------------------------------------

/** Run the consent flow and persist tokens. Returns the stored tokens. */
export async function connectGoogle(): Promise<GoogleTokens> {
    if (!GOOGLE_CLIENT_ID) {
        throw new Error('VITE_GOOGLE_CLIENT_ID is not set — create the Web OAuth client first.');
    }
    const verifier = randomVerifier();
    const challenge = await challengeFromVerifier(verifier);
    const redirectUri = await getRedirectURL();

    const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
    authUrl.search = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: DRIVE_FILE_SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline', // ask for a refresh token
        prompt: 'consent', // force refresh_token issuance on re-consent
    }).toString();

    const launch = await chrome.runtime.sendMessage({
        type: 'GOOGLE_LAUNCH_WEB_AUTH_FLOW',
        url: authUrl.toString(),
    });
    if (!launch?.success || !launch.redirect) {
        throw new Error(launch?.error || 'Auth flow returned no redirect.');
    }

    const returned = new URL(launch.redirect as string);
    const err = returned.searchParams.get('error');
    if (err) throw new Error(`Google denied authorization: ${err}`);
    const code = returned.searchParams.get('code');
    if (!code) throw new Error('No authorization code in redirect.');

    const data = await callProxy({
        action: 'exchange',
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
    });

    if (!data.refresh_token) {
        throw new Error('No refresh_token returned — revoke prior access at myaccount.google.com and retry.');
    }
    const tokens: GoogleTokens = {
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string,
        expiry: Date.now() + (data.expires_in as number) * 1000,
        scope: data.scope as string | undefined,
    };
    await writeTokens(tokens);
    return tokens;
}

/** Return a valid access token, refreshing through the proxy if needed. */
export async function getAccessToken(): Promise<string> {
    const tokens = await readTokens();
    if (!tokens) throw new Error('Not connected to Google.');

    if (Date.now() < tokens.expiry - EXPIRY_BUFFER_MS) {
        return tokens.access_token;
    }

    const data = await callProxy({ action: 'refresh', refresh_token: tokens.refresh_token });
    const updated: GoogleTokens = {
        ...tokens,
        access_token: data.access_token as string,
        expiry: Date.now() + (data.expires_in as number) * 1000,
    };
    await writeTokens(updated);
    return updated.access_token;
}

export async function isConnected(): Promise<boolean> {
    return (await readTokens()) !== null;
}

export async function disconnectGoogle(): Promise<void> {
    await chrome.storage.local.remove(TOKEN_KEY);
}

/** TEST-ONLY: backdate the access token so the next getAccessToken() forces a refresh. */
export async function expireAccessTokenForTest(): Promise<void> {
    const tokens = await readTokens();
    if (!tokens) throw new Error('Not connected to Google.');
    await writeTokens({ ...tokens, expiry: Date.now() - 1000 });
}
