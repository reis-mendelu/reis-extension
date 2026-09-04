// Pure helpers for the App Store release cut (scripts/release-ios.ts).
//
// Everything here is deliberately side-effect free so the parts that are
// expensive to get wrong — picking a build number App Store Connect will
// accept, asking for an export that does NOT try to upload — are covered by
// tests instead of being discovered at the end of a ten-minute archive.

/** Claims for a JWT that authenticates against the App Store Connect API. */
export interface AscJwtClaims {
  iss: string;
  iat: number;
  exp: number;
  aud: 'appstoreconnect-v1';
}

/** A CFBundleVersion split into its derived base and its rebuild counter. */
function parse(value: string): { base: number; counter: number } | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return null;
  return { base: Number(m[1]), counter: m[2] === undefined ? 0 : Number(m[2]) };
}

/**
 * The next CFBundleVersion that App Store Connect will accept.
 *
 * `base` is what scripts/lib/iosVersion.ts derives from package.json (5.1.1 ->
 * "50101"); `existing` is every CFBundleVersion already uploaded for this app,
 * across every marketing version.
 *
 * Why this queries ASC rather than incrementing what is stamped in the pbxproj:
 * the stamp is per-checkout, and a build uploaded from a different worktree (or
 * one whose stamp was reconciled back down) is invisible to it. ASC is the only
 * thing that actually knows what is taken, and a duplicate is rejected at the
 * very end of the chain — after the archive, the export and the upload.
 *
 * The counter is taken from the HIGHEST existing one, never from the count:
 * deleting a build in ASC does not free its number for reuse.
 */
export function nextBundleVersion(base: string, existing: string[]): string {
  if (!/^\d+$/.test(base)) {
    throw new Error(
      `Build-number base '${base}' is not a plain integer. It comes from ` +
        'deriveIosVersion() without a rebuild counter — pass that, not a full CFBundleVersion.'
    );
  }
  const wanted = Number(base);
  let highest: number | null = null;
  for (const value of existing) {
    const parsed = parse(value);
    // Unparseable or from another train: not our problem, and not a reason to
    // abandon a release.
    if (!parsed || parsed.base !== wanted) continue;
    if (highest === null || parsed.counter > highest) highest = parsed.counter;
  }
  return highest === null ? base : `${base}.${highest + 1}`;
}

/**
 * exportOptions.plist for `xcodebuild -exportArchive`.
 *
 * `destination` is `export`, not `upload`, on purpose: upload needs a
 * signed-in Apple account, which xcodebuild cannot reach on this Mac ("Failed
 * to find an account with App Store Connect access"). The upload is a separate
 * `xcrun altool` step authenticated with an API key.
 *
 * The team is passed here (and on the archive command line) because the
 * committed project.pbxproj deliberately has no DEVELOPMENT_TEAM — it is a
 * personal team, and committing it breaks signing for everyone else.
 */
export function exportOptionsPlist(teamId: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>method</key>',
    '\t<string>app-store-connect</string>',
    '\t<key>destination</key>',
    '\t<string>export</string>',
    '\t<key>signingStyle</key>',
    '\t<string>automatic</string>',
    '\t<key>teamID</key>',
    `\t<string>${teamId}</string>`,
    '\t<key>uploadSymbols</key>',
    '\t<true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

/**
 * The leaf signing authority from `codesign -dvvv` output.
 *
 * The archive is signed *Apple Development* and the export re-signs it as
 * *Apple Distribution*; checking this is how we know the export actually
 * re-signed rather than passing the development build straight through.
 */
export function parseSigningAuthority(codesignOutput: string): string | null {
  const m = /^Authority=(.+)$/m.exec(codesignOutput);
  return m ? m[1].trim() : null;
}

/**
 * Claims for the ASC API token. Apple rejects a token whose lifetime exceeds
 * 20 minutes, so this asks for 15 — long enough for a slow query, short enough
 * that a leaked token from a CI log is worthless by the time anyone reads it.
 */
export function ascJwtClaims(issuerId: string, nowMs: number = Date.now()): AscJwtClaims {
  const iat = Math.floor(nowMs / 1000);
  return { iss: issuerId, iat, exp: iat + 15 * 60, aud: 'appstoreconnect-v1' };
}
