// Stamp the iOS project with the version from package.json.
//
// Android does this at build time inside Gradle, so it can never be forgotten.
// Xcode has no equivalent hook that survives `npx cap sync`, so this runs as
// part of `cap:sync` instead — the step every iOS build already goes through.
// Running it by hand is `npm run ios:version`.
//
// Re-uploading a fixed build under an UNCHANGED marketing version needs a
// higher CFBundleVersion or App Store Connect refuses it as a duplicate:
//
//     REIS_IOS_BUILD=2 npm run ios:version
//
// See scripts/lib/iosVersion.ts for why that is a third component rather than a
// bumped integer.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveIosVersion, patchPbxproj } from './lib/iosVersion';

const PBXPROJ = resolve(process.cwd(), 'ios/App/App.xcodeproj/project.pbxproj');
const PACKAGE_JSON = resolve(process.cwd(), 'package.json');

const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version: string };
const ios = deriveIosVersion(version, process.env.REIS_IOS_BUILD);

const before = readFileSync(PBXPROJ, 'utf8');
const after = patchPbxproj(before, ios);

if (before === after) {
  console.log(`ios: already at ${ios.marketingVersion} (${ios.bundleVersion}) — nothing to write`);
} else {
  writeFileSync(PBXPROJ, after);
  console.log(
    `ios: MARKETING_VERSION ${ios.marketingVersion}, CURRENT_PROJECT_VERSION ${ios.bundleVersion}` +
      ` — from package.json ${version}`
  );
}
