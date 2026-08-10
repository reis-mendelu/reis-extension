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
 * shortcut: an iPad is 834pt wide in portrait, the width test alone therefore
 * sent it to the desktop layout, and that layout is genuinely broken under
 * Capacitor — `SubjectFileDrawer/PdfViewer.tsx` calls bare
 * `chrome.runtime.getURL`, which does not exist off the extension, and the
 * failure is swallowed into a spinner that never resolves. A tablet running a
 * phone layout at worst looks roomy; a tablet running the desktop tree cannot
 * open a file.
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
