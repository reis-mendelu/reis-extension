import type { Plugin } from 'vite';
import {
  ALL_FEATURES,
  SCHOOL_PROFILES,
  isSchoolId,
  type Feature,
  type SchoolProfile,
} from '../src/utils/schoolProfiles';

// Builds for another school on the same UIS (IS4U) system:
//
//   REIS_SCHOOL=vse npx wxt zip    → .output/insis.vse.cz
//   REIS_SCHOOL=czu npx wxt zip    → .output/is.czu.cz
//
// The school's row in src/utils/schoolProfiles.ts gives the host and the
// features. Every `is.mendelu.cz` in the bundle and the manifest becomes that
// host, "IS MENDELU" becomes "IS", and Supabase is cut off, so such an install
// never reaches the production database (its "PEF" would land in MENDELU's PEF
// counts). Unset, the build is the normal MENDELU one.
//
// A school with a `listing` in its profile (VŠE) is a store listing of its own:
// the manifest takes the listing's name and description and keeps only the
// hosts its features use. `npm run zip:vse` is its store zip, and ship.yml's
// VŠE job builds one per release. A school without a listing (ČZU) is a
// prototype and is named so. MENDELU-only parsers remain where a school differs
// (see research/czu-dump/audit-2026-10-26.md).
//
//   REIS_SCHOOL=vse REIS_PROTOTYPE=1 npx wxt zip    → .output/is.mendelu.cz
//
// VŠE's features against MENDELU's own host, Supabase still cut off: the only
// way to boot-test another school's build on an account we can sign in with.
// It needs a school other than MENDELU; on its own it is refused.

const MENDELU = SCHOOL_PROFILES.mendelu;
const SUPABASE_HOST = 'zvbpgkmnrqyprtkyxkwn.supabase.co';

function schoolFromEnv(): SchoolProfile {
  const named = process.env.REIS_SCHOOL || 'mendelu';
  if (process.env.REIS_IS_HOST)
    throw new Error(
      'REIS_IS_HOST is gone: name the school, e.g. REIS_SCHOOL=vse or REIS_SCHOOL=czu'
    );
  if (!isSchoolId(named))
    throw new Error(`REIS_SCHOOL=${named} is not a school in src/utils/schoolProfiles.ts`);
  if (named === 'mendelu' && process.env.REIS_PROTOTYPE === '1')
    throw new Error('REIS_PROTOTYPE=1 builds another school against MENDELU: add REIS_SCHOOL=vse');
  return SCHOOL_PROFILES[named];
}

export const SCHOOL = schoolFromEnv();
/** The IS host the bundle talks to: the school's, or MENDELU's for a prototype. */
export const IS_HOST = process.env.REIS_PROTOTYPE === '1' ? MENDELU.host : SCHOOL.host;
export const isHostSwapped = SCHOOL.id !== MENDELU.id;

export function swapHost(text: string): string {
  return (
    text
      .replaceAll(MENDELU.host, IS_HOST)
      .replaceAll('is\\.mendelu\\.cz', IS_HOST.replaceAll('.', '\\.'))
      .replaceAll(SUPABASE_HOST, 'supabase.invalid')
      // Visible wording ("Otevřít v IS MENDELU", "Původní IS Mendelu"): just "IS".
      .replace(/\bIS (?:MENDELU|Mendelu)\b/g, 'IS')
  );
}

export function isHostSwapPlugin(): Plugin {
  return {
    name: 'reis-school',
    enforce: 'pre',
    // Read by src/utils/school.ts.
    config: () => ({
      define: { 'import.meta.env.VITE_REIS_SCHOOL': JSON.stringify(SCHOOL.id) },
    }),
    // A MENDELU build's code is never rewritten. Gates are runtime
    // `currentSchool.has()` calls, so another school's bundle still carries
    // MENDELU-only code that it never renders.
    transform(code, id) {
      if (!isHostSwapped || id.includes('/node_modules/')) return null;
      if (!/mendelu/i.test(code) && !code.includes(SUPABASE_HOST)) return null;
      return { code: swapHost(code), map: null };
    },
  };
}

const REIS_DATA_CDN = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/*';

/**
 * The hosts a feature reaches beyond the school's own IS. A build for another
 * school keeps only the hosts of the features it has, so a store reviewer sees
 * no permission the build never uses. Supabase is never kept: such a build is
 * cut off (swapHost). raw.githubusercontent.com and mendelu.cz have no user in
 * src/, so no other school gets them.
 */
export const FEATURE_HOSTS: Partial<Record<Feature, readonly string[]>> = {
  // Tiles (the host the OSM identity rule needs), place search, map data.
  campusMap: ['https://tile.openstreetmap.org/*', 'https://photon.komoot.io/*', REIS_DATA_CDN],
  successRates: [REIS_DATA_CDN],
  similarSubjects: [REIS_DATA_CDN],
  erasmus: [REIS_DATA_CDN, 'https://hei.api.uni-foundation.eu/*'],
  canteenMenu: ['https://skm.mendelu.cz/*', 'https://sklubpixie.cz/*'],
};

const isUrl = (p: string) => p.includes('://');

/**
 * Same swap on the generated manifest (content-script matches, host
 * permissions), then the school's own identity:
 * - Only the IS host and the hosts of the school's features stay. Without the
 *   map, its OSM tile rule and the permission for it go too.
 * - A listing build takes the listing's name and description and drops
 *   `browser_specific_settings`: it is a Chrome listing, and the Firefox data
 *   categories there describe MENDELU's Supabase flows.
 * - A prototype says so in its name and gets its own Firefox add-on id, so it
 *   installs next to reIS instead of replacing it (Chrome gives an unpacked
 *   build its own id).
 */
export function swapManifest(manifest: Record<string, unknown>): void {
  const swapped = JSON.parse(swapHost(JSON.stringify(manifest))) as Record<string, unknown>;
  const has = (f: Feature) => SCHOOL.features[f];
  const hosts = new Set([
    `https://${IS_HOST}/*`,
    ...ALL_FEATURES.filter(has).flatMap((f) => FEATURE_HOSTS[f] ?? []),
  ]);
  const keep = (p: string) => !isUrl(p) || hosts.has(p);
  if (Array.isArray(swapped.host_permissions))
    swapped.host_permissions = (swapped.host_permissions as string[]).filter(keep);
  // MV2 folds the hosts in here.
  if (Array.isArray(swapped.permissions))
    swapped.permissions = (swapped.permissions as string[])
      .filter(keep)
      .filter((p) => has('campusMap') || p !== 'declarativeNetRequestWithHostAccess');
  if (!has('campusMap')) delete swapped.declarative_net_request;

  const listing = process.env.REIS_PROTOTYPE === '1' ? null : SCHOOL.listing;
  if (listing) {
    delete swapped.browser_specific_settings;
    Object.assign(swapped, { name: listing.name, description: listing.description });
  } else {
    const bss = swapped.browser_specific_settings as { gecko?: { id?: string } } | undefined;
    if (bss?.gecko) bss.gecko.id = `reis-prototype@${IS_HOST}`;
    swapped.name =
      IS_HOST === SCHOOL.host
        ? `reIS – ${IS_HOST} prototyp`
        : `reIS – ${SCHOOL.name} prototyp na ${IS_HOST}`;
  }
  // In place, deletions included: WXT writes out the object it handed us.
  for (const key of Object.keys(manifest)) if (!(key in swapped)) delete manifest[key];
  Object.assign(manifest, swapped);
}

/**
 * Why a school's store zip must not be made yet. Today that is one thing: a
 * privacy policy URL that is still a placeholder, which the store's privacy
 * form needs. Checked by `npm run zip:vse` (scripts/assertStoreReady.ts) and by
 * ship.yml's VŠE job; a plain `REIS_SCHOOL=vse npx wxt zip` still builds.
 */
export function storeZipProblems(school: SchoolProfile): string[] {
  if (!school.listing) return [`${school.name} has no listing in src/utils/schoolProfiles.ts.`];
  const { privacyPolicyUrl, privacyPolicyDoc } = school.listing;
  if (/^https:\/\/\S+$/.test(privacyPolicyUrl)) return [];
  return [
    `${school.name}'s privacy policy URL is "${privacyPolicyUrl}". Publish ${privacyPolicyDoc} and put its URL in src/utils/schoolProfiles.ts first.`,
  ];
}
