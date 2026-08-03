export interface DevPhoneOverrideInput {
  /** The `?mobile=` query param value, or null when absent. */
  param: string | null;
  isNarrow: boolean;
}

/**
 * Decides the dev-webapp phone override.
 *
 * An explicit `?mobile=1` / `?mobile=0` pins the layout and wins over width.
 * Unpinned, a narrow viewport forces the phone branch, and a wide one returns
 * `null` — the store's "no opinion, defer to the viewport" value. Returning
 * `null` rather than `false` there is behaviourally identical today (the wide
 * case implies `isNarrow === false`, so `isTouch && isNarrow` is false either
 * way) but it states what we actually mean, instead of asserting a desktop
 * override we were never asked for.
 */
export function resolveDevPhoneOverride({
  param,
  isNarrow,
}: DevPhoneOverrideInput): boolean | null {
  if (param === '1') return true;
  if (param === '0') return false;
  return isNarrow ? true : null;
}
