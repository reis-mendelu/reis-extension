import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * On a Mac, a download goes through the macOS Save panel and the eduroam
 * profile goes straight to macOS, never through the iOS share sheet.
 *
 * reIS reaches a Mac as its iPad app ("Designed for iPad"). That is an iOS
 * process, so every iOS flow landed there too, and downloading a file opened
 * AirDrop, Messages, Notes and Freeform where a desktop opens a Save panel.
 * The decision is native (`ProcessInfo.isiOSAppOnMac`, native/capacitor-mac-save),
 * because an iPad's WKWebView also calls itself Macintosh.
 *
 * This is the native app only, on purpose: it runs the PHONE tree
 * (src/components/mobile/ via src/mobile/), and the change sits below both
 * trees in src/mobile/, which the browser extension does not use for files.
 * The extension downloads through the browser itself, which already saves into
 * Downloads like any other site. iPhone and iPad keep the share sheet: there it
 * IS the save flow.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('a Mac saves instead of sharing', () => {
  it.each(['src/mobile/openIsFile.ts', 'src/mobile/eduroamProfile.ts'])(
    '%s routes a Mac through macSave, and keeps the share sheet for iPhone and iPad',
    (file) => {
      const src = read(file);
      expect(src).toContain("from './macSave'");
      expect(src).toContain('isMacApp');
      expect(src).toContain('@capacitor/share');
    }
  );

  it('src/mobile/deliverFile.ts has a Save-panel delivery for a Mac', () => {
    expect(read('src/mobile/deliverFile.ts')).toContain("'saved'");
  });

  it('decides "is a Mac" natively, never from the user agent', () => {
    const src = read('src/mobile/macSave.ts');
    expect(src).toContain("registerPlugin<MacSavePlugin>('MacSave')");
    expect(src).not.toMatch(/navigator\.(userAgent|platform)/);
    expect(
      read('native/capacitor-mac-save/ios/Sources/MacSavePlugin/MacSavePlugin.swift')
    ).toContain('isiOSAppOnMac');
  });

  it('the phone tree tells a Mac student where macOS put the eduroam profile', () => {
    // src/components/mobile/sheets/EduroamSheet.tsx: its Mac-in-app step. The
    // desktop drawer is the extension's, where the browser downloads the file.
    expect(read('src/components/mobile/sheets/EduroamSheet.tsx')).toContain(
      'eduroam.macApp.installStep'
    );
  });

  it('leaves a link share alone: sharing a link is a deliberate share', () => {
    expect(read('src/mobile/shareLink.ts')).not.toContain('macSave');
  });

  it('the extension never reaches the Mac Save panel', () => {
    // useFileActions sends only the Capacitor host down openNativeFile; the
    // extension keeps its browser download. The eduroam profile reaches the
    // Mac branch only after its own `kind !== 'capacitor'` early return.
    expect(read('src/mobile/openIsFile.ts')).toContain("getPlatform().kind === 'capacitor'");
    expect(read('src/hooks/ui/useFileActions.ts')).toMatch(/if \(isNativeHost\(\)\)/);
    const profile = read('src/mobile/eduroamProfile.ts');
    expect(profile.indexOf("deps.kind !== 'capacitor'")).toBeLessThan(
      profile.indexOf('deps.isMac()')
    );
  });
});
