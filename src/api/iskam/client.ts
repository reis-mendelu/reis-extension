import { IskamAuthError } from './errors';

export const ISKAM_BASE = 'https://webiskam.mendelu.cz';

const LANG_COOKIE_PATH: Record<'cz' | 'en', string> = {
    cz: 'cs-CZ',
    en: 'en-US',
};

function isAuthRedirect(response: Response): boolean {
    return (
        response.url.includes('alibaba.mendelu.cz') ||
        response.url.includes('/idp/') ||
        response.url.includes('/Home/Index')
    );
}

export async function fetchIskam(path: string, lang: 'cz' | 'en' = 'cz'): Promise<string> {
    // Double-encode the path to match what the WebISKAM server expects (%252f → decoded to %2f → decoded to /).
    const langPath = encodeURIComponent(encodeURIComponent(path));
    const langSwitch = `${ISKAM_BASE}/Localize/ChangeLang?changeLanguage=${langPath}&lang=${LANG_COOKIE_PATH[lang]}`;

    // Follow the redirect: ChangeLang sets the lang cookie and redirects to the page.
    // Capture the redirected response directly instead of doing a second fetch.
    const response = await fetch(langSwitch, { credentials: 'include' });

    if (isAuthRedirect(response)) {
        throw new IskamAuthError();
    }
    if (!response.ok) {
        throw new Error(`WebISKAM request failed: ${response.status}`);
    }
    const html = await response.text();
    if (html.includes('alibaba.mendelu.cz/idp')) {
        throw new IskamAuthError();
    }
    return html;
}

export async function postIskam(path: string, body: URLSearchParams): Promise<string> {
    const response = await fetch(`${ISKAM_BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (isAuthRedirect(response)) throw new IskamAuthError();
    if (!response.ok) throw new Error(`WebISKAM POST failed: ${response.status}`);
    const html = await response.text();
    if (html.includes('alibaba.mendelu.cz/idp')) throw new IskamAuthError();
    return html;
}

export async function requestIskam(path: string): Promise<string> {
    const response = await fetch(`${ISKAM_BASE}${path}`, { credentials: 'include' });
    if (isAuthRedirect(response)) {
        throw new IskamAuthError();
    }
    if (!response.ok) {
        throw new Error(`WebISKAM request failed: ${response.status}`);
    }
    const html = await response.text();
    if (html.includes('alibaba.mendelu.cz/idp')) {
        throw new IskamAuthError();
    }
    return html;
}
