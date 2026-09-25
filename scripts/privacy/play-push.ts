// Pushes privacy/play-data-safety.csv to Play Data safety. Runs ONLY inside
// .github/workflows/play-data-safety.yml, where the service account lives:
// the same Google Cloud service account the Chrome Web Store publish uses,
// added in Play Console → Users and permissions for this app.
//
// API: POST androidpublisher/v3/applications/{package}/dataSafety with
// {"safetyLabels": <csv text>}; an empty 200 is success.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PACKAGE = 'cz.reis.app';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function serviceAccountJwt(email: string, privateKey: string, now: number): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 600,
    })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(privateKey))}`;
}

async function main(): Promise<void> {
  const email = process.env.SA_EMAIL ?? '';
  // Secrets often store the PEM with literal \n; restore real newlines.
  const key = (process.env.SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('SA_EMAIL / SA_PRIVATE_KEY are not set');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: serviceAccountJwt(email, key, Math.floor(Date.now() / 1000)),
    }),
  });
  const token = ((await tokenRes.json()) as { access_token?: string }).access_token;
  if (!token) throw new Error(`token request failed: HTTP ${tokenRes.status}`);

  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/dataSafety`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ safetyLabels: readFileSync('privacy/play-data-safety.csv', 'utf-8') }),
    }
  );
  if (!res.ok) throw new Error(`dataSafety push failed: HTTP ${res.status} ${await res.text()}`);
  console.log('Play Data safety: privacy/play-data-safety.csv accepted.');
}

if (process.argv[1]?.endsWith('play-push.ts')) await main();
