#!/usr/bin/env node
/**
 * Build a release Android artifact end to end.
 *
 *   node scripts/android-release.mjs apk    -> android/app/build/outputs/apk/release/
 *   node scripts/android-release.mjs aab    -> android/app/build/outputs/bundle/release/
 *
 * This exists instead of a bare `cd android && ./gradlew assembleRelease` for
 * three reasons, each of which has already cost this project a broken build:
 *
 * 1. There is no `java` on PATH on the dev machine. Gradle's error when JAVA_HOME
 *    is unset is not obviously about a missing JDK, so we resolve one first and
 *    say which we picked.
 * 2. `cap sync` rewrites `android/capacitor.settings.gradle` with *resolved*
 *    paths. Inside a git worktree whose node_modules is a symlink, those resolve
 *    to the other checkout's absolute path — it builds fine here and breaks
 *    every other clone. We snapshot the file and restore it if sync rewrote it.
 * 3. An unsigned release APK installs nowhere. We assert the artifact is signed
 *    rather than leaving that to be discovered on the phone.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = resolve(ROOT, 'android');

const target = process.argv[2] ?? 'apk';
if (!['apk', 'aab'].includes(target)) {
  console.error(`Unknown target "${target}". Use "apk" or "aab".`);
  process.exit(1);
}

/** First JDK that actually exists, in order of preference. */
function resolveJdk() {
  const candidates = [
    process.env.JAVA_HOME,
    '/opt/homebrew/opt/openjdk@21',
    '/opt/homebrew/opt/openjdk@17',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  ].filter(Boolean);
  for (const home of candidates) {
    if (existsSync(resolve(home, 'bin/java'))) return home;
  }
  console.error(
    'No JDK found. Install one with `brew install openjdk@21`, or set JAVA_HOME to an existing JDK.'
  );
  process.exit(1);
}

function resolveAndroidHome() {
  const home =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    resolve(process.env.HOME ?? '', 'Library/Android/sdk');
  if (!existsSync(home)) {
    console.error(`Android SDK not found at ${home}. Set ANDROID_HOME.`);
    process.exit(1);
  }
  return home;
}

const JAVA_HOME = resolveJdk();
const ANDROID_HOME = resolveAndroidHome();
const env = { ...process.env, JAVA_HOME, ANDROID_HOME };

console.log(`JDK          ${JAVA_HOME}`);
console.log(`Android SDK  ${ANDROID_HOME}`);

const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
console.log(`Version      ${version}`);

const signed =
  existsSync(resolve(ANDROID, 'keystore.properties')) || Boolean(process.env.REIS_KEYSTORE_FILE);
if (!signed) {
  console.error(
    '\nNo signing key configured — the build would produce an UNSIGNED artifact that\n' +
      'cannot be installed. Create android/keystore.properties first; see\n' +
      'docs/android-beta-release.md for the exact keytool command.\n'
  );
  process.exit(1);
}

const run = (cmd, args, cwd = ROOT) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, env, stdio: 'inherit' });
};

// --- web bundle + native sync -------------------------------------------------
// `cap sync` regenerates capacitor.settings.gradle from the resolved location of
// node_modules; see the header note. Snapshot before, compare after.
const SETTINGS = resolve(ANDROID, 'capacitor.settings.gradle');

/**
 * Read a file, or null if it is not there.
 *
 * `existsSync` followed by `readFileSync` is two separate trips to the
 * filesystem, and `cap sync` is rewriting this very file — so the answer to the
 * first can be stale by the time the second runs. Catching ENOENT off the read
 * itself makes the check and the use one operation.
 */
function readIfPresent(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

const settingsBefore = readIfPresent(SETTINGS);

run('npm', ['run', 'build:capacitor']);
run('npx', ['cap', 'sync', 'android']);

if (settingsBefore !== null) {
  const after = readIfPresent(SETTINGS);
  if (
    after !== null &&
    after !== settingsBefore &&
    /\.claude\/worktrees|\.\.\/\.\.\/\.\./.test(after)
  ) {
    console.log('\ncap sync rewrote capacitor.settings.gradle with worktree-absolute paths.');
    console.log('Restoring the committed version — the build works with either.');
    writeFileSync(SETTINGS, settingsBefore);
  }
}

// --- gradle -------------------------------------------------------------------
const gradleTask = target === 'apk' ? 'assembleRelease' : 'bundleRelease';
run('./gradlew', [gradleTask], ANDROID);

// --- verify -------------------------------------------------------------------
const out =
  target === 'apk'
    ? resolve(ANDROID, 'app/build/outputs/apk/release/app-release.apk')
    : resolve(ANDROID, 'app/build/outputs/bundle/release/app-release.aab');

// stat once and reuse it, rather than existsSync-then-stat: same check-and-use
// race as the settings file, and the size is wanted below anyway.
let outStat;
try {
  outStat = statSync(out);
} catch {
  console.error(`\nExpected artifact missing: ${out}`);
  console.error('If an "app-release-unsigned.apk" exists instead, the keystore was not picked up.');
  process.exit(1);
}

if (target === 'apk') {
  // apksigner ships per build-tools version; take the highest installed.
  // Sorted in JS rather than by shelling out to `ls | sort -V | tail -1`:
  // ANDROID_HOME comes from the environment, so interpolating it into a shell
  // string lets a path containing shell metacharacters run arbitrary commands.
  // readdirSync takes the path as data, so there is no shell to inject into.
  const buildTools = readdirSync(resolve(ANDROID_HOME, 'build-tools'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .pop();
  if (!buildTools) {
    console.error(`No build-tools installed under ${ANDROID_HOME}/build-tools`);
    process.exit(1);
  }
  const apksigner = resolve(ANDROID_HOME, 'build-tools', buildTools, 'apksigner');
  console.log(`\n$ apksigner verify --print-certs (build-tools ${buildTools})`);
  execFileSync(apksigner, ['verify', '--print-certs', out], { env, stdio: 'inherit' });
}

// Same reasoning as above — `du -h "$out"` put a path into a shell string.
const size = `${(outStat.size / 1024 / 1024).toFixed(1)}M`;
console.log(`\nBuilt ${target.toUpperCase()}  ${out}  (${size})`);
console.log(
  target === 'apk'
    ? 'Install with:  adb install -r "' + out + '"'
    : 'Upload this .aab to the Play Console internal testing track.'
);
