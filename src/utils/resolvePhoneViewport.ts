export interface PhoneViewportInput {
  isTouch: boolean;
  isNarrow: boolean;
  /** True on the Capacitor build (the iOS/Android app), false in any browser. */
  isNativeApp?: boolean;
  /** Dev-only forced value. null/undefined defers to the viewport. */
  override?: boolean | null;
}

/**
 * Single source of truth for "is this a phone".
 *
 * In a **browser** it is a measurement: coarse pointer AND narrow viewport, so a
 * narrow desktop window stays desktop and a tablet visiting IS stays desktop.
 *
 * In the **native app it is not a measurement at all** — the app ships only the
 * phone tree, so being the app is the whole answer. This is deliberate and not a
 * shortcut: an iPad is 834pt wide in portrait, so the width test alone sent it
 * to the desktop layout, which is not a tree this app builds, exercises or
 * verifies on a device. A tablet running the phone layout at worst looks roomy.
 *
 * The original note here also cited PdfViewer's bare `chrome.runtime.getURL`
 * hanging the desktop tree under Capacitor. That specific defect is fixed — the
 * worker now resolves through the platform's `getAssetUrl`, and the phone tree
 * mounts the same viewer — so it is no longer the reason. The width argument
 * above is, and it stands on its own.
 *
 * Kept pure and separate from the store so it is testable without a DOM, and so
 * the dev override has one place to apply. The override still wins over
 * everything, native included — that is what makes the desktop tree reachable in
 * the dev webapp.
 */
export function resolvePhoneViewport({
  isTouch,
  isNarrow,
  isNativeApp = false,
  override,
}: PhoneViewportInput): boolean {
  if (override === true || override === false) return override;
  if (isNativeApp) return true;
  return isTouch && isNarrow;
}
