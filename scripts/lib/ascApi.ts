// Minimal App Store Connect API client — enough to ask which build numbers are
// already taken, and nothing else.
//
// The private key is read from disk at call time and never logged, never
// copied, and never passed through an environment variable: Apple's own tools
// (`xcrun altool --apiKey`) expect the .p8 to sit in
// ~/.appstoreconnect/private_keys/, so that file IS the credential store and
// this reads from the same place rather than inventing a second one.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { ascJwtClaims } from './iosRelease';

export interface AscCredentials {
  keyId: string;
  issuerId: string;
  /** Absolute path to AuthKey_<keyId>.p8. */
  keyPath: string;
}

const SETUP_HINT =
  'App Store Connect -> Users and Access -> Integrations -> App Store Connect API -> ' +
  'generate a key with the App Manager role, then:\n' +
  '  mkdir -p ~/.appstoreconnect/private_keys\n' +
  '  mv ~/Downloads/AuthKey_<KEYID>.p8 ~/.appstoreconnect/private_keys/\n' +
  '  export ASC_KEY_ID=<KEYID> ASC_ISSUER_ID=<ISSUER-UUID>\n' +
  'Apple lets a key be downloaded exactly once, and the same file is what ' +
  '`xcrun altool --upload-app` reads.';

/**
 * Resolve the API credentials, or explain precisely what is missing.
 *
 * Fails loudly rather than degrading to "build but do not upload": a release
 * that archives, exports and then quietly stops one step short of the store is
 * indistinguishable from a successful one in a scrollback.
 */
export function resolveAscCredentials(env: NodeJS.ProcessEnv = process.env): AscCredentials {
  const keyId = env.ASC_KEY_ID?.trim();
  const issuerId = env.ASC_ISSUER_ID?.trim();
  if (!keyId || !issuerId) {
    throw new Error(`ASC_KEY_ID and ASC_ISSUER_ID must both be set.\n\n${SETUP_HINT}`);
  }
  const candidates = [
    env.ASC_KEY_PATH,
    resolve(homedir(), '.appstoreconnect/private_keys', `AuthKey_${keyId}.p8`),
    resolve(homedir(), 'private_keys', `AuthKey_${keyId}.p8`),
  ].filter((p): p is string => Boolean(p));
  const keyPath = candidates.find((p) => existsSync(p));
  if (!keyPath) {
    throw new Error(
      `No AuthKey_${keyId}.p8 found. Looked in:\n  ${candidates.join('\n  ')}\n\n${SETUP_HINT}`
    );
  }
  return { keyId, issuerId, keyPath };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** ES256 JWT. Apple rejects anything else, including RS256. */
export function signAscToken(creds: AscCredentials, nowMs?: number): string {
  const header = { alg: 'ES256', kid: creds.keyId, typ: 'JWT' };
  const claims = ascJwtClaims(creds.issuerId, nowMs);
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  // ieee-p1363 is the raw r||s encoding JWS requires; the default DER encoding
  // produces a token Apple silently rejects as 401 NOT_AUTHORIZED.
  const signature = createSign('SHA256')
    .update(signingInput)
    .sign({
      key: readFileSync(creds.keyPath, 'utf8'),
      dsaEncoding: 'ieee-p1363',
    });
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Every CFBundleVersion already uploaded for this app, newest first.
 *
 * Includes builds that were never submitted and builds that expired — App
 * Store Connect deduplicates against all of them.
 */
export async function listBuildVersions(appId: string, creds: AscCredentials): Promise<string[]> {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/builds');
  url.searchParams.set('filter[app]', appId);
  url.searchParams.set('fields[builds]', 'version');
  url.searchParams.set('sort', '-version');
  url.searchParams.set('limit', '200');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${signAscToken(creds)}` } });
  if (!res.ok) {
    throw new Error(
      `App Store Connect returned ${res.status} ${res.statusText} for the build list. ` +
        `Body: ${(await res.text()).slice(0, 500)}`
    );
  }
  const body = (await res.json()) as { data?: Array<{ attributes?: { version?: string } }> };
  return (body.data ?? [])
    .map((b) => b.attributes?.version)
    .filter((v): v is string => typeof v === 'string');
}
