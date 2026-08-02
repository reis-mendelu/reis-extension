import { safeFilename } from './safeFilename';

export interface DeliverDeps {
  platform: 'ios' | 'android' | 'web';
  /** Android: write into the Downloads folder and post a system notification. */
  saveToDownloads(o: { filename: string; base64: string; mime: string }): Promise<{ uri: string }>;
  /** iOS: hand the file to the Files/share sheet. */
  shareFile(o: { filename: string; base64: string; mime: string }): Promise<void>;
}

export type DeliveryKind = 'downloads' | 'share';

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
 */
export function deliveryKindFor(platform: 'ios' | 'android' | 'web'): DeliveryKind {
  return platform === 'android' ? 'downloads' : 'share';
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

  const kind = deliveryKindFor(deps.platform);
  if (kind === 'downloads') {
    await deps.saveToDownloads({ filename, base64, mime });
  } else {
    await deps.shareFile({ filename, base64, mime });
  }
  return kind;
}
