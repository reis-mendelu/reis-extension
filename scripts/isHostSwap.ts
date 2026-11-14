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
// counts). Unset, the build is the normal MENDELU one. Not a release path yet:
// no Novinky, no daily count, and MENDELU-only parsers where a school differs
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

const FEATURE_CHECK = /\bcurrentSchool\.has\(\s*(['"])(\w+)\1\s*\)/g;
const ID_READ = /\bcurrentSchool\.id\b/g;

/**
 * `currentSchool.has('campusMap')` becomes the literal `true` or `false` this
 * school's profile says, and `currentSchool.id` its id, so the build drops a
 * branch the school lacks, as it did for the old `IS_OTHER_SCHOOL` constant.
 * A call is not something Rollup folds by itself. Builds without this plugin
 * (dev webapp, Capacitor) answer the same at runtime.
 */
function foldSchoolChecks(code: string): string {
  if (!code.includes('currentSchool.')) return code;
  return code
    .replace(FEATURE_CHECK, (_, _q, feature: string) => {
      if (!(ALL_FEATURES as readonly string[]).includes(feature))
        throw new Error(`currentSchool.has('${feature}'): no such feature in schoolProfiles.ts`);
      return String(SCHOOL.features[feature as Feature]);
    })
    .replace(ID_READ, JSON.stringify(SCHOOL.id));
}

export function isHostSwapPlugin(): Plugin {
  return {
    name: 'reis-school',
    enforce: 'pre',
    // Read by src/utils/school.ts.
    config: () => ({
      define: { 'import.meta.env.VITE_REIS_SCHOOL': JSON.stringify(SCHOOL.id) },
    }),
    transform(code, id) {
      if (id.includes('/node_modules/')) return null;
      let out = foldSchoolChecks(code);
      // The profile table keeps every school's real host.
      const swaps = isHostSwapped && !id.includes('/src/utils/schoolProfiles.ts');
      if (swaps && (/mendelu/i.test(out) || out.includes(SUPABASE_HOST))) out = swapHost(out);
      return out === code ? null : { code: out, map: null };
    },
  };
}

/**
 * Same swap on the generated manifest: content-script matches, host permissions.
 * The build also gets its own Firefox add-on id, so it installs next to reIS
 * instead of replacing it (Chrome gives an unpacked build its own id).
 */
export function swapManifest(manifest: Record<string, unknown>): void {
  const swapped = JSON.parse(swapHost(JSON.stringify(manifest))) as Record<string, unknown>;
  const bss = swapped.browser_specific_settings as { gecko?: { id?: string } } | undefined;
  if (bss?.gecko) bss.gecko.id = `reis-prototype@${IS_HOST}`;
  Object.assign(manifest, swapped, { name: `reIS – ${IS_HOST} prototyp` });
}
