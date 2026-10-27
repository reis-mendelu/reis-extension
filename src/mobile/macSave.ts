import { Capacitor, registerPlugin } from '@capacitor/core';
import { ShareCanceledError } from '../errors/shareCanceled';

interface MacSavePlugin {
  isMac(): Promise<{ mac: boolean }>;
  /** Rejects with code `cancelled` when the student closes the panel. */
  save(o: { url: string }): Promise<{ url: string }>;
  open(o: { url: string }): Promise<{ opened: boolean }>;
}

/**
 * native/capacitor-mac-save. reIS reaches a Mac as this same iOS app
 * ("Designed for iPad"), where `Capacitor.getPlatform()` answers `ios`, so
 * every iOS behaviour lands there too. Two of them are wrong on a desktop:
 * a download opening the iOS share sheet (AirDrop, Messages, Notes…) instead
 * of the Save panel, and the eduroam profile going the same way instead of to
 * macOS's own profile install.
 *
 * Why not write straight into ~/Downloads, the way Android does: measured on
 * the Mac app (2026-10-26), the sandbox refuses it. `.downloadsDirectory` is the
 * container's symlink to ~/Downloads and writing there fails with EPERM; the
 * `com.apple.security.files.downloads.read-write` entitlement is dropped when
 * an iOS-SDK build is signed. The Save panel is the only door.
 */
const MacSave = registerPlugin<MacSavePlugin>('MacSave');

let macPromise: Promise<boolean> | null = null;

/**
 * Whether this is the iOS app running on a Mac. Native decides, from
 * `ProcessInfo.isiOSAppOnMac`, for the reason `eduroamNative.ts` gives: the
 * user agent says `Macintosh` in an iPad's WKWebView too.
 *
 * Asked once, lazily, by the first download — not at boot, since nothing reads
 * it during render. Any failure reads as "not a Mac", so an iPhone or iPad
 * whose native half cannot answer keeps the share sheet it has always had.
 */
export function isMacApp(): Promise<boolean> {
  if (!macPromise) {
    macPromise =
      Capacitor.getPlatform() !== 'ios'
        ? Promise.resolve(false)
        : Promise.resolve()
            .then(() => MacSave.isMac())
            .then(
              (r) => r.mac === true,
              () => false
            );
  }
  return macPromise;
}

/**
 * Offers a file the app already wrote to the macOS Save panel, opening in the
 * student's Downloads folder. Closing the panel is a choice, so it becomes the
 * same `ShareCanceledError` a dismissed share sheet does, and no caller shows a
 * warning for it.
 */
export async function saveWithPanel(fileUri: string): Promise<void> {
  try {
    await MacSave.save({ url: fileUri });
  } catch (e) {
    if ((e as { code?: string } | null)?.code === 'cancelled') throw new ShareCanceledError();
    throw e;
  }
}

/** Hands a file or a system URL to macOS. False when macOS would not take it. */
export async function openOnMac(url: string): Promise<boolean> {
  return (await MacSave.open({ url })).opened === true;
}

/** Test-only. Never call from app code. */
export function __resetMacSaveForTests(): void {
  macPromise = null;
}
