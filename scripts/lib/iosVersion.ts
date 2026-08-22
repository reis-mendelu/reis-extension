// Version for the iOS app, derived from package.json — the same single source
// of truth android/app/build.gradle reads.
//
// The stock Capacitor template hardcodes MARKETING_VERSION 1.0 and
// CURRENT_PROJECT_VERSION 1 in project.pbxproj. Left alone, the App Store would
// show reIS as "1.0" beside Play's "5.0.6", and the second TestFlight upload
// would be refused as a duplicate build number.
//
// The integer encoding is deliberately IDENTICAL to Android's versionCode
// (major*10000 + minor*100 + patch, so 5.0.6 -> 50006), so one number
// identifies a build on both stores and a crash report from either is easy to
// place. The bounds checks below exist for the same reason they do in Gradle:
// 5.0.100 and 5.1.0 would otherwise share 50100.

export interface IosVersion {
  /** CFBundleShortVersionString — what a tester sees. */
  marketingVersion: string;
  /** CFBundleVersion — the build number App Store Connect deduplicates on. */
  bundleVersion: string;
}

/**
 * @param rebuild Optional counter for re-uploading a fixed build under an
 *   UNCHANGED marketing version. This has no Android equivalent: Play only
 *   needs versionCode to rise, whereas App Store Connect requires
 *   CFBundleVersion to be unique and increasing *within* one
 *   CFBundleShortVersionString train, and iterating TestFlight builds inside a
 *   single version is routine. Apple accepts up to three period-separated
 *   integers, so the counter becomes a third component rather than disturbing
 *   the derived number.
 */
export function deriveIosVersion(npmVersion: string, rebuild?: number | string): IosVersion {
  const semver = /^(\d+)\.(\d+)\.(\d+)$/.exec(npmVersion);
  if (!semver) {
    throw new Error(
      `package.json version '${npmVersion}' is not a plain major.minor.patch semver. ` +
        'Prerelease and build-metadata suffixes are refused: they cannot be encoded ' +
        'into a distinct CFBundleVersion.'
    );
  }
  const [major, minor, patch] = semver.slice(1, 4).map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(
      `package.json version '${npmVersion}' has a minor or patch of 100 or more, which ` +
        'would collide with the next component up (5.0.100 and 5.1.0 both come to 50100). ' +
        'Widen the encoding in scripts/lib/iosVersion.ts before releasing this version.'
    );
  }
  const derived = major * 10000 + minor * 100 + patch;

  let bundleVersion = String(derived);
  if (rebuild !== undefined) {
    const n = Number(rebuild);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(
        `rebuild counter '${rebuild}' must be a whole number of 1 or more — it becomes the ` +
          'third component of CFBundleVersion, which Apple requires to be an integer.'
      );
    }
    bundleVersion = `${derived}.${n}`;
  }

  return { marketingVersion: npmVersion, bundleVersion };
}

/**
 * Rewrite the version settings in an Xcode project file.
 *
 * Xcode repeats every build setting once per configuration, so this replaces
 * ALL occurrences — patching only the first is how a Release build ships still
 * claiming 1.0. Absence of either key throws rather than returning the input
 * unchanged: a regex that silently matches nothing would leave the project on
 * the template version while the script still exited 0.
 */
export function patchPbxproj(source: string, version: IosVersion): string {
  const settings: Array<[string, string]> = [
    ['MARKETING_VERSION', version.marketingVersion],
    ['CURRENT_PROJECT_VERSION', version.bundleVersion],
  ];

  let out = source;
  for (const [key, value] of settings) {
    const pattern = new RegExp(`${key} = [^;]+;`, 'g');
    const hits = out.match(pattern);
    if (!hits) {
      throw new Error(
        `${key} not found in project.pbxproj. Xcode may have renamed or reformatted the ` +
          'setting; fix scripts/lib/iosVersion.ts rather than letting the build ship the ' +
          'template version.'
      );
    }
    out = out.replace(pattern, `${key} = ${value};`);
  }
  return out;
}
