// Submit the App Store build for review. Runs in .github/workflows/ship.yml
// right after `release:ios` has uploaded the build, or locally.
//
//   npx tsx scripts/release/ios-submit.ts --version 5.4.1 [--dry-run]
//
// Reads the agreed notes from release-notes/<version>.cs.txt and refuses to
// submit without them. Sequence and safety rules: scripts/lib/iosSubmit.ts.
import { appendFileSync } from 'node:fs';
import { resolveAscCredentials, signAscToken } from '../lib/ascApi';
import { submitIosVersion, type AscHttp } from '../lib/iosSubmit';
import { loadReleaseNotes } from '../lib/releaseNotes';

const APP_ID = process.env.REIS_ASC_APP_ID ?? '6804832714';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const version = arg('--version');
  if (!version) throw new Error('--version x.y.z is required.');
  const dryRun = process.argv.includes('--dry-run');
  const notes = loadReleaseNotes(version);
  const creds = resolveAscCredentials();

  const asc: AscHttp = async (method, path, body) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${signAscToken(creds)}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `ASC ${method} ${path.split('?')[0]} -> ${res.status}: ${text.slice(0, 400)}`
      );
    }
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };

  const out = await submitIosVersion({ asc, appId: APP_ID, version, notes, dryRun });
  const line = `${dryRun ? 'DRY RUN ' : ''}App Store: ${out.status} - ${out.detail}`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
