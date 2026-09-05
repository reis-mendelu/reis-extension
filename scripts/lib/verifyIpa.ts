// Check what is actually inside the .ipa before it is uploaded.
//
// Every assertion here corresponds to something that has already shipped or
// nearly shipped wrong: a development-signed build, a stale CFBundleVersion
// that ASC rejects after the upload finishes, and a binary carrying error
// telemetry the privacy policy says is not there.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
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
export const runCombined = (cmd: string, args: string[]): string => {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  return `${res.stdout ?? ''}${res.stderr ?? ''}`;
};

/**
 * Refuse a path that a command-line tool could read as an option.
 *
 * Everything here is spawned WITHOUT a shell (spawnSync/execFileSync with an
 * argv array), so a hostile file name cannot become a command. What it can
 * still do is start with `-` and be parsed as a flag by grep, unzip or
 * codesign — which would make the verification inspect something other than
 * the build about to be uploaded. Paths reaching these helpers are built with
 * join() from an absolute temp dir, so this asserts an invariant that already
 * holds rather than repairing a broken one; it fails loudly if that ever
 * changes.
 */
export function assertSafePath(path: string): string {
  if (!isAbsolute(path)) {
    throw new Error(`Refusing to run a tool against the relative path '${path}'.`);
  }
  return path;
}

/**
 * Files under `dir` containing any of `needles`.
 *
 * grep exits 1 for "no matches" and 2 for a real failure (an unreadable path,
 * a bad option). Only 1 may be read as clean: swallowing 2 turns "the scan
 * never ran" into "the scan found nothing", and that difference is a binary
 * uploaded without ever being checked.
 */
export function grepFiles(dir: string, needles: string[]): string[] {
  // `--` before the path operand, and an absolute path from assertSafePath():
  // a directory whose name begins with `-` would otherwise be read as options
  // rather than as the thing to scan, and the scan would silently cover
  // something else. No shell is involved anywhere here — spawnSync gets an argv
  // array — so the names can never become commands.
  const args = ['-rl', ...needles.flatMap((n) => ['-e', n]), '--', assertSafePath(dir)];
  const res = spawnSync('grep', args, { encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status === 1) return [];
  if (res.status !== 0) {
    throw new Error(
      `grep exited ${res.status} while scanning ${dir} — the bundle was NOT scanned: ${res.stderr?.trim()}`
    );
  }
  return res.stdout.split('\n').filter(Boolean);
}

/** Unzip the ipa to a temp dir and read the facts worth failing on. */
export function inspectIpa(ipaPath: string): IpaFacts {
  const dir = mkdtempSync(join(tmpdir(), 'reis-ipa-'));
  run('unzip', ['-q', assertSafePath(resolve(ipaPath)), '-d', dir]);
  const payload = join(dir, 'Payload');
  // The bundle name comes out of the archive, so it is the one value here this
  // process did not choose. A name with a slash in it would put the tools
  // somewhere else entirely.
  const appName = readdirSync(payload).find((e) => e.endsWith('.app') && !e.includes('/'));
  if (!appName) throw new Error(`No .app inside ${ipaPath} — the export produced something else.`);
  const app = assertSafePath(join(payload, appName));
  const plist = join(app, 'Info.plist');

  const signing = runCombined('codesign', ['-dvvv', app]);

  const plistValue = (key: string) =>
    run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]).trim();

  return {
    authority: parseSigningAuthority(signing),
    bundleVersion: plistValue('CFBundleVersion'),
    marketingVersion: plistValue('CFBundleShortVersionString'),
    telemetryHits: grepFiles(app, ['report_error', 'sendTelemetry']),
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
