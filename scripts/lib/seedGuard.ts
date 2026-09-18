/**
 * Deciding whether a `verify:ui --seed-store` seed survived to the screenshot.
 *
 * Kept out of `shot.ts` and out of the browser so it can be tested: this is the
 * guard that turns a clobbered seed — a run that measures an UNSEEDED page and
 * reports every finding as clean — into a loud failure, and a guard nobody
 * tests is exactly as trustworthy as the false-green it is meant to catch.
 *
 * The page hands back the current values of the seeded keys; the comparison
 * happens here, in Node.
 */

/**
 * JSON with object keys sorted at every depth, so a store that rebuilt a slice
 * with identical content but a different key order does not read as drift.
 * Array order is left alone — in a schedule it carries meaning.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
        )
      : val
  );
}

/** Seeded keys whose value in the running app no longer matches what was seeded. */
export function driftedSeedKeys(
  seeded: Record<string, unknown>,
  actual: Record<string, unknown>
): string[] {
  return Object.keys(seeded).filter(
    (k) => stableStringify(actual[k]) !== stableStringify(seeded[k])
  );
}
