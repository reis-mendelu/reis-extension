#!/usr/bin/env node
/**
 * Build the RELEASE APK and install it on a phone over Wi-Fi — the exact
 * artifact testers get, not a debug or live-reload build.
 *
 *   npm run android:push              # build, install over the existing reIS, launch
 *   npm run android:push -- --wifi    # phone on USB: switch adb to Wi-Fi first
 *
 * The APK is signed with the upload key (android/keystore.properties), so it
 * installs over a sideloaded reIS signed with the same key and keeps the login
 * and data. Over a PLAY install it fails INSTALL_FAILED_UPDATE_INCOMPATIBLE —
 * Play re-signs with the app signing key — and replacing that means an
 * uninstall, so this script refuses to do it for you.
 *
 * `--wifi` uses `adb tcpip`, which lasts until the phone reboots. After a
 * reboot, plug in once and pass --wifi again; passing it while already on
 * Wi-Fi is harmless. Works over the phone's own hotspot too (the Mac joins it;
 * the phone is then the gateway), and in that case a dropped adb connection is
 * re-made automatically.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APK = resolve(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
const ANDROID_HOME =
  process.env.ANDROID_HOME ?? resolve(process.env.HOME ?? '', 'Library/Android/sdk');
const ADB = resolve(ANDROID_HOME, 'platform-tools/adb');
// Gradle rejects the brew prefix as JAVA_HOME; it needs the libexec bundle path.
const BREW_JDK = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const env = {
  ...process.env,
  ANDROID_HOME,
  ...(!process.env.JAVA_HOME && existsSync(BREW_JDK) && { JAVA_HOME: BREW_JDK }),
};

const fail = (msg) => {
  console.error(`\n${msg}`);
  process.exit(1);
};
const adb = (...argv) => execFileSync(ADB, argv, { env, encoding: 'utf8' }).trim();
const devices = () =>
  adb('devices')
    .split('\n')
    .slice(1)
    .map((l) => l.split('\t'))
    .filter(([, state]) => state === 'device')
    .map(([serial]) => serial);

/**
 * Re-attach to a phone whose adb is still in tcpip mode after the Mac's adb
 * lost it (sleep, network blip, adb server restart). Only the hotspot case is
 * knowable without being told an address: there, the phone is this Mac's
 * default gateway.
 */
function reconnectViaGateway() {
  let gateway;
  try {
    gateway = execFileSync('route', ['-n', 'get', 'default'], { encoding: 'utf8' }).match(
      /gateway: (\d+\.\d+\.\d+\.\d+)/
    )?.[1];
  } catch {
    return undefined;
  }
  if (!gateway) return undefined;
  const out = adb('connect', `${gateway}:5555`);
  return /connected to/.test(out) ? `${gateway}:5555` : undefined;
}

function switchToWifi() {
  const present = devices();
  const usb = present.find((s) => !s.includes(':'));
  if (!usb) {
    // Already on Wi-Fi (tcpip survives until the phone reboots) — nothing to switch.
    const wifi = present.find((s) => s.includes(':')) ?? reconnectViaGateway();
    if (wifi) return wifi;
    fail('--wifi needs the phone on USB first, with USB debugging allowed.');
  }
  // Any wlan* address: wlan0 as a Wi-Fi client, wlan1 as the hotspot the Mac is on.
  const ip = adb('-s', usb, 'shell', 'ip', '-f', 'inet', 'addr')
    .split('\n')
    .map((l) => l.match(/inet (\d+\.\d+\.\d+\.\d+)\/\d+ .*\bwlan\d+$/))
    .find(Boolean)?.[1];
  if (!ip)
    fail("The phone has no Wi-Fi address. Join the Mac's Wi-Fi, or put the Mac on its hotspot.");
  adb('-s', usb, 'tcpip', '5555');
  execFileSync('sleep', ['3']);
  console.log(adb('connect', `${ip}:5555`));
  console.log('Wi-Fi adb is up — the cable can come out.');
  return `${ip}:5555`;
}

const wifi = process.argv.includes('--wifi')
  ? switchToWifi()
  : devices().length === 0
    ? reconnectViaGateway()
    : undefined;
const all = devices();
// Prefer the Wi-Fi transport: with the cable also in, the same phone is listed twice.
const serial = wifi ?? process.env.ANDROID_SERIAL ?? all.find((s) => s.includes(':')) ?? all[0];
if (!serial || !all.includes(serial)) {
  fail(
    'No phone reachable over adb. Plug it in and run `npm run android:push -- --wifi`,\n' +
      'or `adb connect <phone-ip>:5555` if Wi-Fi adb is still up.'
  );
}

execFileSync('node', [resolve(ROOT, 'scripts/android-release.mjs'), 'apk'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

console.log(`\n$ adb -s ${serial} install -r app-release.apk`);
try {
  console.log(adb('-s', serial, 'install', '-r', APK));
} catch (err) {
  if (String(err.stderr ?? err).includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) {
    fail(
      'The reIS on the phone is signed with a different key (a Play install).\n' +
        'Replacing it needs `adb uninstall cz.reis.app` — that signs you out and\n' +
        'takes the phone off Play updates. Do that by hand if you mean it.'
    );
  }
  throw err;
}
adb('-s', serial, 'shell', 'am', 'start', '-n', 'cz.reis.app/.MainActivity');
console.log(`\nInstalled and launched on ${serial}.`);
