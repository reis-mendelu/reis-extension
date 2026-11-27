/**
 * The daily IS + WebISKAM snapshot. launchd runs it every morning
 * (install-launchd.mjs); by hand:
 *
 *   npm run snapshots                      # what the morning job does
 *   npm run snapshots -- --headed          # WebISKAM in a window, to accept alibaba's consent once
 *   npm run snapshots -- --from <dump> --out <dir> [--date YYYY-MM-DD]
 *                                          # offline: a saved dump instead of logging in
 *
 * Writes into the archive (archive.ts) in Dominik's Drive. A site that
 * cannot be read is logged in changes.md and raised as a macOS notification;
 * the other site is still saved.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { recordDay, type Capture } from './archive';
import { readDump, readIs } from './isRead';
import { KEYCHAIN_SERVICE, readCredentials } from './keychain';
import { readWebiskam } from './webiskam';

const DRIVE = resolve(
  homedir(),
  'Library/CloudStorage/GoogleDrive-darksoothingshadow@gmail.com/My Drive'
);
const ARCHIVE = join(DRIVE, 'IS snímky');
/** run.ts runs bundled (start.mjs), always from the repo root: npm sets the cwd. */
const README = resolve('scripts/snapshots/ARCHIVE-README.md');

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const option = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/**
 * Exit codes for the launchd wrapper (install-launchd.mjs): it raises its own
 * notification for any other code, i.e. when this file never got to run.
 */
const EXIT_PROBLEM = 3;
const EXIT_CRASH = 4;

const log = (msg: string) => process.stdout.write(`${new Date().toISOString()} ${msg}\n`);

function notify(message: string): void {
  try {
    execFileSync('osascript', [
      '-e',
      'on run argv',
      '-e',
      'display notification (item 1 of argv) with title "IS snímky"',
      '-e',
      'end run',
      message,
    ]);
  } catch {
    // a notification is a courtesy; the problem is in changes.md either way
  }
}

/** Local (Prague) date and time: the Mac runs in Europe/Prague. */
function now(): { date: string; time: string } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * launchd runs a missed 07:00 the moment the Mac wakes, often before Wi-Fi is
 * back. Wait for IS to answer (up to ~5 min) instead of logging a lost day.
 */
async function waitForNetwork(): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    try {
      await fetch('https://is.mendelu.cz/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000),
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
  return false;
}

async function live(): Promise<{ captures: Capture[]; problems: string[] }> {
  const creds = readCredentials();
  if (!creds)
    return { captures: [], problems: [`no login in the Keychain under "${KEYCHAIN_SERVICE}"`] };
  // IS down (or no network yet) still lets WebISKAM, a separate system, be read.
  const is = (await waitForNetwork())
    ? await readIs(creds)
    : { captures: [], problems: ['IS: did not answer for 5 minutes (no network, or IS down)'] };
  log(`IS: ${is.captures.length} pages, ${is.problems.length} problems`);
  let iskam: { captures: Capture[]; problem: string | null };
  try {
    iskam = await readWebiskam(creds, flag('--headed'));
  } catch (err) {
    iskam = {
      captures: [],
      problem: `WebISKAM: ${err instanceof Error ? err.message.split('\n')[0] : 'error'}`,
    };
  }
  log(`WebISKAM: ${iskam.captures.length} pages${iskam.problem ? `, ${iskam.problem}` : ''}`);
  return {
    captures: [...is.captures, ...iskam.captures],
    problems: [...is.problems, ...(iskam.problem ? [iskam.problem] : [])],
  };
}

async function main(): Promise<number> {
  const from = option('--from');
  const out = option('--out') ?? process.env.REIS_SNAPSHOTS_DIR ?? ARCHIVE;
  // Never create a look-alike folder when Drive for desktop is not running:
  // the morning would "succeed" into a local folder nobody looks at.
  if (out === ARCHIVE && !existsSync(DRIVE)) {
    const problem = `Google Drive is not mounted at ${DRIVE}`;
    log(problem);
    notify(problem);
    return EXIT_PROBLEM;
  }
  const { date, time } = {
    ...now(),
    ...(option('--date') ? { date: option('--date') as string } : {}),
  };
  const { captures, problems } = from ? { captures: readDump(from), problems: [] } : await live();
  const { changed } = recordDay(out, { date, time, captures, problems });
  copyFileSync(README, join(out, 'README.md'));
  log(`${captures.length} pages read, ${changed.length} changed → ${out}`);
  for (const p of problems) log(`problem: ${p}`);
  if (problems.length && !from) notify(problems.join(' · '));
  return problems.length ? EXIT_PROBLEM : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    log(`failed: ${message}`);
    notify(`run failed: ${message.split('\n')[0]}`);
    process.exit(EXIT_CRASH);
  }
);
