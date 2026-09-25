/**
 * Campus navigation — "Najdi cestu", the gate → building walks, the route card
 * — is parked. Everything behind it stays in the tree and under test; this is
 * the one switch that decides whether a student can reach it.
 *
 * Off because the feature is not in use yet, and shipping it means asking all
 * three stores to review a location permission for nothing. The permission and
 * the plugin are stripped too, not just hidden — see
 * src/test/guards/campusNavigationIsDormant.test.ts for what switching this
 * back on takes.
 */
export const CAMPUS_NAVIGATION_ENABLED = false;
