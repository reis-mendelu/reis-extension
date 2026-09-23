#!/usr/bin/env node
/**
 * Sign the reIS app into IS on an attached Android device, with the
 * MENDELU_USER / MENDELU_PASS from `.env`.
 *
 *   npm run android:signin                       # the one attached device
 *   npm run android:signin -- --device <serial>  # one of several
 *   npm run android:signin -- --dry-run          # find the fields, type nothing
 *
 * Exists because verifying anything past the login on a phone used to stop at
 * "please sign in", every time the app was reinstalled or signed out.
 *
 * This is for the DEVELOPER to run. The credentials are the developer's own,
 * and typing them into a login is a step they take, not one an agent takes on
 * their behalf, which is why nothing in the repo calls this.
 *
 * The values never reach argv on this machine: they travel to the device over
 * `adb shell`'s stdin, so `ps` here does not show them. On the device they are
 * briefly an argument of its `input` process, which is the only interface
 * Android offers for typing. Nothing is logged.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeInputText, findLoginTargets, isSignedIn, pickDevice } from './lib/androidSignin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const deviceArg = args.includes('--device') ? args[args.indexOf('--device') + 1] : undefined;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveAdb() {
  const sdk = process.env.ANDROID_HOME ?? resolve(homedir(), 'Library/Android/sdk');
  const inSdk = resolve(sdk, 'platform-tools/adb');
  return existsSync(inSdk) ? inSdk : 'adb';
}

const ADB = resolveAdb();
const adb = (serial, cmd, input) =>
  execFileSync(ADB, ['-s', serial, ...cmd], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dump(serial) {
  try {
    return adb(serial, ['exec-out', 'uiautomator', 'dump', '/dev/tty']);
  } catch {
    return ''; // uiautomator fails transiently while the screen is changing
  }
}

/** Poll the screen until `test` passes or the deadline does. */
async function waitFor(serial, test, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    const xml = dump(serial);
    const result = test(xml);
    if (result || Date.now() > deadline) return { xml, result };
    await sleep(1000);
  }
}

const tap = (serial, { x, y }) => adb(serial, ['shell', 'input', 'tap', String(x), String(y)]);
// "$(cat)" inside double quotes is substituted once and never re-parsed, so the
// value's own `$`, quotes and backticks reach `input` as typed.
const type = (serial, text) => adb(serial, ['shell', 'input text "$(cat)"'], text);

async function main() {
  let serial;
  try {
    serial = pickDevice(
      execFileSync(ADB, ['devices'], { encoding: 'utf8' }),
      deviceArg ?? process.env.ANDROID_SERIAL
    );
  } catch (e) {
    fail(e.message);
  }

  let user;
  let pass;
  if (!dryRun) {
    const envFile = resolve(ROOT, '.env');
    if (existsSync(envFile)) process.loadEnvFile(envFile);
    if (!process.env.MENDELU_USER || !process.env.MENDELU_PASS) {
      fail('MENDELU_USER and MENDELU_PASS must be set in .env (see .env.example).');
    }
    // Validated before anything is tapped, so a value `input text` cannot type
    // fails here instead of half-filling the form.
    try {
      user = encodeInputText(process.env.MENDELU_USER);
      pass = encodeInputText(process.env.MENDELU_PASS);
    } catch (e) {
      fail(`Cannot type the credentials: ${e.message}`);
    }
  }

  adb(serial, ['shell', 'am', 'start', '-n', 'cz.reis.app/.MainActivity']);

  const { xml, result: targets } = await waitFor(
    serial,
    (x) => findLoginTargets(x) ?? (isSignedIn(x) ? 'signed-in' : null),
    30_000
  );
  if (targets === 'signed-in') {
    console.log(`Already signed in on ${serial}.`);
    return;
  }
  if (!targets) {
    fail(
      xml.includes('cz.reis.app')
        ? 'reIS is open but the IS login is not on screen. Is it signed in already, or still loading?'
        : 'reIS did not come to the front. Is it installed and the device unlocked?'
    );
  }

  if (dryRun) {
    console.log(`IS login found on ${serial}:`, JSON.stringify(targets));
    return;
  }

  tap(serial, targets.user);
  await sleep(400);
  type(serial, user);
  tap(serial, targets.pass);
  await sleep(400);
  type(serial, pass);
  // Enter submits the form, and still works when the keyboard now covers the
  // button the dump located before it opened.
  adb(serial, ['shell', 'input', 'keyevent', 'KEYCODE_ENTER']);

  const { result: done } = await waitFor(serial, isSignedIn, 60_000);
  if (!done) {
    fail('Still not signed in after 60s. Check MENDELU_USER / MENDELU_PASS, or look at the phone.');
  }
  console.log(`Signed in on ${serial}.`);
}

main().catch((e) => fail(e.message));
