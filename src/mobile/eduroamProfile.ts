import { buildSaveDeps } from './saveDeps';
import { logError } from '../utils/reportError';
import { isMacApp, openOnMac, saveWithPanel } from './macSave';

/**
 * System Settings › General › Device Management, on its "Downloaded" profiles.
 * The same link macOS's own "Profile Downloaded" follow-up opens (read from
 * mdmclient's log on the Mac app, 2026-10-26).
 */
export const PROFILES_DOWNLOADED_URL =
  'x-apple.systempreferences:com.apple.Profiles-Settings.extension?action=showPurgatory';

/**
 * How the eduroam profile reaches the student, as data so the rules above it
 * are testable without a plugin.
 *
 * The first four members are `SaveDeps`; the rest is the part a profile needs
 * and a downloaded document does not — see `deliverEduroamProfile`.
 */
export interface ProfileDelivery {
  kind: 'extension' | 'capacitor' | 'web';
  anchorSave(blob: Blob, filename: string): void;
  nativeSave(blob: Blob, filename: string): Promise<string>;
  assertExists(uri: string): Promise<boolean>;
  share(uri: string): Promise<void>;
  /** Whether this iOS app runs on a Mac (see `macSave.ts`). */
  isMac(): Promise<boolean>;
  /** Mac: hand a file or a system link to macOS. False if it would not take it. */
  openOnMac(url: string): Promise<boolean>;
  /** Mac: offer the file to the Save panel. Cancelling rejects with ShareCanceledError. */
  saveWithPanel(uri: string): Promise<void>;
}

/**
 * Puts the eduroam `.mobileconfig` where the student can open it.
 *
 * In a browser this is the download it has always been. Inside the app it is
 * not: a blob URL with `a[download]` does nothing in a WKWebView (measured, and
 * the reason `saveDocument.ts` exists), so the profile has to be written by the
 * app and then handed over.
 *
 * **Both halves are required.** `Directory.Documents` is inside the app's
 * container and `UIFileSharingEnabled` is absent from `Info.plist`, so a file
 * written and not shared is a file no student can reach — a worse outcome than
 * the error this replaces, because it looks like it worked. On an iPhone or
 * iPad the share sheet is what turns it into a real file.
 *
 * **On a Mac** the hand-over is macOS's own. Opening the written
 * `.mobileconfig` gives it to the system's profile handler, which files it
 * under Device Management as "Downloaded"; the settings link then opens that
 * pane, so the student lands on Install without hunting for a file. If macOS
 * will not open it, the Save panel puts it somewhere the student can reach.
 * Cancelling that panel is not "done", unlike a dismissed share sheet: the
 * file would stay in the app's container, which no student can open.
 *
 * Why a Mac gets a profile at all rather than the one-tap path: see
 * `resolveNativeEduroamSupport` in `eduroamNative.ts`.
 */
export async function deliverEduroamProfile(
  blob: Blob,
  filename: string,
  deps: ProfileDelivery
): Promise<void> {
  if (deps.kind !== 'capacitor') {
    deps.anchorSave(blob, filename);
    return;
  }

  const uri = await deps.nativeSave(blob, filename);
  // Before sharing, not after: sharing a path that holds nothing hands the
  // student an empty file and calls it success.
  if (!(await deps.assertExists(uri))) {
    throw new Error(`eduroam profile was not saved: ${filename}`);
  }

  if (await deps.isMac()) {
    if (filename.endsWith('.mobileconfig') && (await deps.openOnMac(uri))) {
      await deps.openOnMac(PROFILES_DOWNLOADED_URL);
      return;
    }
    await deps.saveWithPanel(uri);
    return;
  }

  try {
    await deps.share(uri);
  } catch (e) {
    // Dismissing the sheet rejects here, and that is a choice rather than a
    // fault: the file is on disk and the sheet's own instructions still hold.
    // Failing the flow for it would show an error for a deliberate tap.
    logError('Eduroam.shareProfile', e);
  }
}

/** The real wiring. Lazy plugin import, for the reason `saveDeps` gives. */
export function buildProfileDelivery(): ProfileDelivery {
  const save = buildSaveDeps();
  return {
    ...save,
    async share(uri) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ url: uri });
    },
    isMac: isMacApp,
    openOnMac,
    saveWithPanel,
  };
}
