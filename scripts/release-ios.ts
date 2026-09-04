// Cut an App Store build from the current commit, end to end:
//
//   sync web assets -> pick a build number -> archive -> export -> verify -> upload
//
// This is the iOS half of the release train. `test` -> `main` with a version
// bump pushes `vX.Y.Z` (release-tag.yml); this turns that tag into a binary in
// App Store Connect. It deliberately STOPS at upload — attaching the build to
// a version and submitting for review stays a human decision, because a
// submission cannot be recalled and `test` is not a protected branch.
//
//   npm run release:ios                 # cut from HEAD
//   npm run release:ios -- --tag v5.1.1 # ...and assert HEAD is that tag
//   npm run release:ios -- --skip-upload
//
// Credentials and the traps: docs/ios-release.md.
import { config as loadDotenv } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listBuildVersions, resolveAscCredentials } from './lib/ascApi';
import { exportOptionsPlist, parseReleaseArgs, reserveBundleVersion } from './lib/iosRelease';
import { deriveIosVersion, readBundleVersion } from './lib/iosVersion';
import { assertUploadable, inspectIpa } from './lib/verifyIpa';

const ROOT = process.cwd();
// ASC_ISSUER_ID lives in the gitignored root .env (the private key itself stays
// a file in ~/.appstoreconnect/private_keys and never becomes a variable).
// dotenv does not overwrite what is already in the environment, so an explicit
// export still wins.
loadDotenv({ path: resolve(ROOT, '.env'), quiet: true });
const PBXPROJ = resolve(ROOT, 'ios/App/App.xcodeproj/project.pbxproj');
// Personal team; deliberately absent from the committed pbxproj so other
// people's signing is not broken by it. App record 6804832714 / cz.reis.app.
const TEAM_ID = process.env.REIS_IOS_TEAM ?? 'RG38V3SV8X';
const APP_ID = process.env.REIS_ASC_APP_ID ?? '6804832714';

const { tag: wantedTag, skipUpload } = parseReleaseArgs(process.argv.slice(2));

const step = (msg: string) => console.log(`\n\x1b[1m> ${msg}\x1b[0m`);
const sh = (cmd: string, cmdArgs: string[], env?: NodeJS.ProcessEnv) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
const capture = (cmd: string, cmdArgs: string[]) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8' }).trim();

function fail(message: string): never {
  console.error(`\n\x1b[31mx ${message}\x1b[0m`);
  process.exit(1);
}

function preflight(): string {
  if (process.platform !== 'darwin') fail('An App Store build can only be cut on macOS.');
  try {
    capture('xcrun', ['--find', 'xcodebuild']);
  } catch {
    fail(
      'xcodebuild not found. Install Xcode, then `sudo xcode-select -s /Applications/Xcode.app`.'
    );
  }
  // Untracked files are ignored on purpose (dist-web/, local snapshots); an
  // uncommitted change to a TRACKED file would ship something no commit records.
  const dirty = capture('git', ['status', '--porcelain', '--untracked-files=no']);
  if (dirty) fail(`Uncommitted changes - commit or revert first:\n${dirty}`);

  const { version } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  if (wantedTag) {
    if (wantedTag !== `v${version}`) {
      fail(`--tag ${wantedTag} does not match package.json version ${version}.`);
    }
    const tagged = capture('git', ['rev-list', '-n', '1', wantedTag]);
    const head = capture('git', ['rev-parse', 'HEAD']);
    if (tagged !== head) fail(`HEAD is not ${wantedTag}. Run: git checkout ${wantedTag}`);
  }
  return version;
}

// Set the moment altool is invoked. From then on the build number may already
// be at Apple even if this process dies, and a build takes minutes to appear in
// /v1/builds — so the stamp becomes the only local record that the number is
// spent, and reverting it would let a retry re-send it.
let uploadAttempted = false;

/**
 * Put project.pbxproj back the way the commit has it — unless the upload has
 * already started.
 *
 * The stamp is a build artifact, not a source change, and leaving it modified
 * blocks the next release's preflight. Reverting after a failure is also what
 * makes a retry reuse the number rather than skip one. Neither applies once
 * bytes have gone to Apple.
 */
function restoreVersionStamp() {
  if (uploadAttempted) {
    console.log(
      '\nproject.pbxproj is left stamped so a retry cannot re-send this build number.\n' +
        'Once the build shows in App Store Connect: git checkout -- ios/App/App.xcodeproj/project.pbxproj'
    );
    return;
  }
  try {
    execFileSync('git', ['checkout', '--', 'ios/App/App.xcodeproj/project.pbxproj'], { cwd: ROOT });
  } catch {
    console.warn('Could not revert the version stamp in project.pbxproj — check `git status`.');
  }
}

async function main() {
  const version = preflight();
  const base = deriveIosVersion(version).bundleVersion;
  console.log(`reIS ${version} - App Store cut (team ${TEAM_ID}, app ${APP_ID})`);

  step('Asking App Store Connect which build numbers are taken');
  const creds = resolveAscCredentials();
  const taken = await listBuildVersions(APP_ID, creds);
  const stamped = readBundleVersion(readFileSync(PBXPROJ, 'utf8'));
  const bundleVersion = reserveBundleVersion(base, taken, stamped);
  const counter = bundleVersion.includes('.') ? bundleVersion.split('.')[1] : undefined;
  console.log(
    `  ${taken.length} build(s) known to ASC; local stamp ${stamped ?? 'none'} -> using ${bundleVersion}`
  );

  step('Building web assets into the app and stamping the version (cap:sync)');
  sh('npm', ['run', 'cap:sync'], counter ? { REIS_IOS_BUILD: counter } : {});
  const written = readBundleVersion(readFileSync(PBXPROJ, 'utf8'));
  if (written !== bundleVersion) {
    fail(
      `cap:sync stamped ${written}, not ${bundleVersion}. Refusing to archive a build whose number is not the one reserved.`
    );
  }

  const work = mkdtempSync(join(tmpdir(), 'reis-release-'));
  const archivePath = join(work, 'reIS.xcarchive');
  const exportDir = join(work, 'export');
  const optionsPath = join(work, 'exportOptions.plist');
  writeFileSync(optionsPath, exportOptionsPlist(TEAM_ID));

  step(`Archiving ${version} (${bundleVersion})`);
  sh('xcodebuild', [
    '-project',
    'ios/App/App.xcodeproj',
    '-scheme',
    'App',
    '-configuration',
    'Release',
    '-destination',
    'generic/platform=iOS',
    '-archivePath',
    archivePath,
    `DEVELOPMENT_TEAM=${TEAM_ID}`,
    '-allowProvisioningUpdates',
    'archive',
  ]);

  step('Exporting a distribution-signed .ipa');
  sh('xcodebuild', [
    '-exportArchive',
    '-archivePath',
    archivePath,
    '-exportOptionsPlist',
    optionsPath,
    '-exportPath',
    exportDir,
    '-allowProvisioningUpdates',
  ]);

  step('Verifying the .ipa');
  const ipa = join(exportDir, 'App.ipa');
  const facts = inspectIpa(ipa);
  assertUploadable(facts, bundleVersion);
  console.log(`  ${facts.marketingVersion} (${facts.bundleVersion}), signed by ${facts.authority}`);

  if (skipUpload) {
    console.log(`\n--skip-upload: the verified build is at ${ipa}. Nothing was sent to Apple.`);
    return;
  }

  step('Uploading to App Store Connect');
  uploadAttempted = true;
  sh('xcrun', [
    'altool',
    '--upload-app',
    '-f',
    ipa,
    '-t',
    'ios',
    '--apiKey',
    creds.keyId,
    '--apiIssuer',
    creds.issuerId,
  ]);

  console.log(
    `\n\x1b[32mOK ${version} (${bundleVersion}) uploaded.\x1b[0m Processing takes ~3 minutes.\n` +
      'Nothing is submitted: in App Store Connect, add the build to the version and\n' +
      'submit for review by hand - check the build picker actually selected\n' +
      `${bundleVersion}, it offers stale builds first.`
  );
}

main()
  .then(restoreVersionStamp)
  .catch((err: unknown) => {
    restoreVersionStamp();
    fail(err instanceof Error ? err.message : String(err));
  });
