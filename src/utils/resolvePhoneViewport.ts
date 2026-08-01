export interface PhoneViewportInput {
  isTouch: boolean;
  isNarrow: boolean;
  /** Dev-only forced value. null/undefined defers to the viewport. */
  override?: boolean | null;
}

/**
 * Single source of truth for "is this a phone".
 *
 * Phone = coarse pointer AND narrow viewport, so a narrow desktop window stays
 * desktop and a tablet stays desktop. Kept pure and separate from the store so
 * it is testable without a DOM, and so the dev override has one place to apply.
 */
export function resolvePhoneViewport({ isTouch, isNarrow, override }: PhoneViewportInput): boolean {
  if (override === true || override === false) return override;
  return isTouch && isNarrow;
}
