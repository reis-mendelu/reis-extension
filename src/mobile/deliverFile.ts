import { safeFilename } from './safeFilename';

export interface DeliverDeps {
  platform: 'ios' | 'android' | 'web';
  /** Android: write into the Downloads folder and post a system notification. */
  saveToDownloads(o: { filename: string; base64: string; mime: string }): Promise<{ uri: string }>;
  /** iPhone and iPad: hand the file to the Files/share sheet. */
  shareFile(o: { filename: string; base64: string; mime: string }): Promise<void>;
  /** Whether this iOS app is running on a Mac. Asked on iOS only. */
  isMac(): Promise<boolean>;
  /** Mac: offer the file to the macOS Save panel. */
  saveWithPanel(o: { filename: string; base64: string; mime: string }): Promise<void>;
}

export type DeliveryKind = 'downloads' | 'share' | 'saved';

/**
 * Where a downloaded file should go, per platform.
 *
 * Android gets the behaviour every browser has: the file lands in Downloads and
 * a notification opens it. A share sheet is wrong there — it asks the student
 * to choose an app when they only wanted the file.
 *
 * iOS genuinely has no Downloads folder; the Files/share sheet IS its native
 * save pattern, so it keeps that. This asymmetry is deliberate, not an
 * oversight.
 *
 * A Mac runs the same iOS build and reports `ios`, but a share sheet there is
 * AirDrop and Messages, not a download. It gets the macOS Save panel, which
 * opens in Downloads. Writing to Downloads directly, as Android does, is
 * refused by the sandbox (see `macSave.ts`).
 */
export function deliveryKindFor(platform: 'ios' | 'android' | 'web', mac = false): DeliveryKind {
  if (platform === 'android') return 'downloads';
  return platform === 'ios' && mac ? 'saved' : 'share';
}

export async function deliverFile(
  rawFilename: string,
  base64: string,
  mime: string,
  deps: DeliverDeps
): Promise<DeliveryKind> {
  // The name comes from IS (Content-Disposition, or parsed page metadata), and
  // both branches below hand it to native code that treats it as a path.
  const filename = safeFilename(rawFilename);

  const mac = deps.platform === 'ios' && (await deps.isMac());
  const kind = deliveryKindFor(deps.platform, mac);
  if (kind === 'downloads') {
    await deps.saveToDownloads({ filename, base64, mime });
  } else if (kind === 'saved') {
    await deps.saveWithPanel({ filename, base64, mime });
  } else {
    await deps.shareFile({ filename, base64, mime });
  }
  return kind;
}
