// Release the signed AAB to a Play testing track. Runs in .github/workflows/ship.yml
// after `android-release.mjs aab`, with the service account the Chrome publish
// and the Data safety push already use (SA_EMAIL / SA_PRIVATE_KEY).
//
//   npx tsx scripts/release/play-upload.ts --version 5.4.1 [--aab path] [--track alpha] [--dry-run]
//
// The track defaults to PLAY_TRACK, then "alpha" (the closed-testing track).
// Sequence and safety rules: scripts/lib/playRelease.ts.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serviceAccountJwt } from '../privacy/play-push';
import { releaseToTrack, type PlayHttp } from '../lib/playRelease';
import { loadReleaseNotes } from '../lib/releaseNotes';

const PACKAGE = 'cz.reis.app';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function accessToken(): Promise<string> {
  const email = process.env.SA_EMAIL ?? '';
  // Secrets often store the PEM with literal \n; restore real newlines.
  const key = (process.env.SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('SA_EMAIL / SA_PRIVATE_KEY are not set');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: serviceAccountJwt(email, key, Math.floor(Date.now() / 1000)),
    }),
  });
  const token = ((await res.json()) as { access_token?: string }).access_token;
  if (!token) throw new Error(`Play token request failed: HTTP ${res.status}`);
  return token;
}

async function main(): Promise<void> {
  const version = arg('--version');
  if (!version) throw new Error('--version x.y.z is required.');
  const dryRun = process.argv.includes('--dry-run');
  // `||`, not `??`: an unset repository variable reaches the job as an empty string.
  const track = arg('--track') || process.env.PLAY_TRACK || 'alpha';
  const aab = resolve(arg('--aab') ?? 'android/app/build/outputs/bundle/release/app-release.aab');
  const notes = loadReleaseNotes(version);
  const bundle = readFileSync(aab);
  const token = await accessToken();

  const play: PlayHttp = async (method, path, body) => {
    const isBundle = path.endsWith('/bundles');
    const url = isBundle ? `${UPLOAD}${path}?uploadType=media` : `${API}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': isBundle ? 'application/octet-stream' : 'application/json',
      },
      body: body === undefined ? undefined : isBundle ? (body as Buffer) : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Play ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : {};
  };

  const out = await releaseToTrack({ play, track, versionName: version, notes, bundle, dryRun });
  const line = `${dryRun ? 'DRY RUN ' : ''}Google Play (${track}): ${out.status} - ${out.detail}`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
