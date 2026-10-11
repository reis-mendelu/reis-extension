// exportOptions.plist for a CI runner that signs the export with a distribution
// certificate and App Store profile it was handed (ship.yml imports them), instead
// of asking Apple's cloud signing. Cloud signing needs an API key above App Manager;
// this needs none. Used only when REIS_IOS_PROFILE_NAME is set.
export function manualExportOptionsPlist(
  teamId: string,
  bundleId: string,
  profileName: string
): string {
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
    '\t<string>manual</string>',
    '\t<key>signingCertificate</key>',
    '\t<string>Apple Distribution</string>',
    '\t<key>teamID</key>',
    `\t<string>${teamId}</string>`,
    '\t<key>provisioningProfiles</key>',
    '\t<dict>',
    `\t\t<key>${bundleId}</key>`,
    `\t\t<string>${profileName}</string>`,
    '\t</dict>',
    '\t<key>uploadSymbols</key>',
    '\t<true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}
