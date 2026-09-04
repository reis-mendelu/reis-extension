// Check what is actually inside the .ipa before it is uploaded.
//
// Every assertion here corresponds to something that has already shipped or
// nearly shipped wrong: a development-signed build, a stale CFBundleVersion
// that ASC rejects after the upload finishes, and a binary carrying error
// telemetry the privacy policy says is not there.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSigningAuthority } from './iosRelease';

export interface IpaFacts {
  authority: string | null;
  bundleVersion: string;
  marketingVersion: string;
  /** Files inside the app bundle that still mention error telemetry. */
  telemetryHits: string[];
}

const run = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * stdout AND stderr, ignoring the exit status.
 *
 * `codesign -dvvv` prints everything it knows to STDERR and nothing to stdout,
 * so reading only stdout returns an empty string and every build looks
 * unsigned. That is not hypothetical: the first real run of this script
 * refused a correctly signed .ipa for exactly that reason.
 */
const runCombined = (cmd: string, args: string[]): string => {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  return `${res.stdout ?? ''}${res.stderr ?? ''}`;
};

/** Unzip the ipa to a temp dir and read the facts worth failing on. */
export function inspectIpa(ipaPath: string): IpaFacts {
  const dir = mkdtempSync(join(tmpdir(), 'reis-ipa-'));
  run('unzip', ['-q', ipaPath, '-d', dir]);
  const payload = join(dir, 'Payload');
  const appName = readdirSync(payload).find((e) => e.endsWith('.app'));
  if (!appName) throw new Error(`No .app inside ${ipaPath} — the export produced something else.`);
  const app = join(payload, appName);
  const plist = join(app, 'Info.plist');

  const signing = runCombined('codesign', ['-dvvv', app]);

  const plistValue = (key: string) =>
    run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]).trim();

  let telemetryHits: string[] = [];
  try {
    telemetryHits = run('grep', ['-rl', '-e', 'report_error', '-e', 'sendTelemetry', app])
      .split('\n')
      .filter(Boolean);
  } catch {
    // grep exits 1 with no matches, which is the outcome we want.
    telemetryHits = [];
  }

  return {
    authority: parseSigningAuthority(signing),
    bundleVersion: plistValue('CFBundleVersion'),
    marketingVersion: plistValue('CFBundleShortVersionString'),
    telemetryHits,
  };
}

/** Throw unless the ipa is the distribution-signed build we meant to upload. */
export function assertUploadable(facts: IpaFacts, expected: IpaFacts['bundleVersion']): void {
  const problems: string[] = [];
  if (!facts.authority?.startsWith('Apple Distribution')) {
    problems.push(
      `signed by "${facts.authority ?? 'nothing'}" — the export should have re-signed it as Apple Distribution`
    );
  }
  if (facts.bundleVersion !== expected) {
    problems.push(`CFBundleVersion is ${facts.bundleVersion}, expected ${expected}`);
  }
  if (facts.telemetryHits.length > 0) {
    problems.push(
      `error telemetry is still in the bundle (${facts.telemetryHits.length} file(s)) — the privacy policy says nothing about a failure leaves the device`
    );
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to upload this build:\n  - ${problems.join('\n  - ')}`);
  }
}
