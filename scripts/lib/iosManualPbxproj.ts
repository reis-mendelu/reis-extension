// Switch the App target's Release configuration to manual signing, in project.pbxproj.
//
// Not done with command-line build settings: those apply to EVERY target, and the
// Swift packages' resource bundles fail with "does not support provisioning
// profiles". Only the app target takes a profile, so only its Release block changes.
// The edit lives on the CI runner's checkout; nothing commits it.
const RELEASE_BLOCK = /\t\t[0-9A-F]{24} \/\* Release \*\/ = \{[\s\S]*?\n\t\t\};/g;

export function withManualSigning(pbxproj: string, bundleId: string, profileName: string): string {
  let patched = 0;
  const out = pbxproj.replace(RELEASE_BLOCK, (block) => {
    if (!block.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`)) return block;
    if (!block.includes('CODE_SIGN_STYLE = Automatic;')) return block;
    patched++;
    return block.replace(
      'CODE_SIGN_STYLE = Automatic;',
      'CODE_SIGN_STYLE = Manual;\n' +
        '\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";\n' +
        `\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = ${JSON.stringify(profileName)};`
    );
  });
  if (patched !== 1) {
    throw new Error(
      `Expected exactly one Release configuration for ${bundleId} with automatic signing, found ${patched}.`
    );
  }
  return out;
}
