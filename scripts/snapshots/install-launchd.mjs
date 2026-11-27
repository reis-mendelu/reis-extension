#!/usr/bin/env node
/**
 * Installs (or with --uninstall removes) the LaunchAgent that runs
 * `npm run snapshots` every morning at 07:00 from the MAIN checkout, which
 * follows `test` (see CLAUDE.md, "Worktrees and the main checkout"): a
 * worktree disappears when its session is archived.
 *
 * launchd runs a missed 07:00 when the Mac wakes; a day the Mac is off stays
 * a gap. Output goes to ~/Library/Logs/reIS snapshots.log.
 *
 *   node scripts/snapshots/install-launchd.mjs [--uninstall]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'cz.reisapp.snapshots';

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The plist for one LaunchAgent: `args` run with `cwd` at hour:minute, or once at load. */
export function plist({ label, cwd, args, hour, minute, runAtLoad = false, logFile }) {
  // Homebrew's stable links, not process.execPath (a versioned Cellar folder that
  // `brew upgrade node` removes).
  const path = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
  const when =
    hour === undefined
      ? ''
      : `  <key>StartCalendarInterval</key>\n  <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${xml(label)}</string>
  <key>WorkingDirectory</key><string>${xml(cwd)}</string>
  <key>ProgramArguments</key>
  <array>${args.map((a) => `<string>${xml(a)}</string>`).join('')}</array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${xml(path)}</string></dict>
${when}  <key>RunAtLoad</key><${runAtLoad}/>
  <key>StandardOutPath</key><string>${xml(logFile)}</string>
  <key>StandardErrorPath</key><string>${xml(logFile)}</string>
</dict>
</plist>
`;
}

/**
 * run.ts exits 0, 3 (a problem it already notified) or 4 (a crash it notified).
 * Anything else means it never ran (node gone, a module that fails to load, a
 * stale checkout): say so, or the morning fails with only a log line.
 */
export const WRAPPER = [
  'npm run -s snapshots; code=$?',
  'case $code in 0|3|4) ;; *)',
  `  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "IS snímky"' -e 'end run' "the job did not start (exit $code), see ~/Library/Logs/reIS snapshots.log" ;;`,
  'esac',
  'exit $code',
].join('\n');

export const plistPath = (label) => resolve(homedir(), 'Library/LaunchAgents', `${label}.plist`);
export const LOG_FILE = resolve(homedir(), 'Library/Logs/reIS snapshots.log');

export function load(label, content) {
  const file = plistPath(label);
  const domain = `gui/${userInfo().uid}`;
  try {
    execFileSync('launchctl', ['bootout', `${domain}/${label}`], { stdio: 'ignore' });
  } catch {
    // not loaded yet
  }
  if (content === null) {
    rmSync(file, { force: true });
    return file;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  execFileSync('launchctl', ['bootstrap', domain, file]);
  return file;
}

function mainCheckout() {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  }).trim();
  return dirname(common);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--uninstall')) {
    process.stdout.write(`removed ${load(LABEL, null)}\n`);
  } else {
    const cwd = mainCheckout();
    const file = load(
      LABEL,
      plist({
        label: LABEL,
        cwd,
        args: ['/bin/zsh', '-c', WRAPPER],
        hour: 7,
        minute: 0,
        logFile: LOG_FILE,
      })
    );
    process.stdout.write(`installed ${file}\n  runs daily 07:00 in ${cwd}\n  log: ${LOG_FILE}\n`);
  }
}
