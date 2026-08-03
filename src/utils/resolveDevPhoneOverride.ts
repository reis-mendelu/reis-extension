export interface DevPhoneOverrideInput {
  /** The `?mobile=` query param value, or null when absent. */
  param: string | null;
  isNarrow: boolean;
}

/**
 * Decides the dev-webapp phone override.
 *
 * An explicit `?mobile=1` / `?mobile=0` pins the layout; anything else follows
 * the viewport width. Returns a plain boolean rather than the tri-state the
 * store accepts: `false` at a wide width is what `isTouch && isNarrow` would
 * have produced anyway, so pinning it costs nothing and keeps the caller simple.
 */
export function resolveDevPhoneOverride({ param, isNarrow }: DevPhoneOverrideInput): boolean {
  if (param === '1') return true;
  if (param === '0') return false;
  return isNarrow;
}
