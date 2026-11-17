/**
 * The schools reIS can be built for, all on the same UIS (IS4U) software, and
 * what each one has. Plain data with no imports and no `import.meta`, so the
 * build script (scripts/isHostSwap.ts, run in Node) reads the same table the
 * app does. The app asks `currentSchool` (utils/school.ts), never this table.
 *
 * A feature is named for the capability, not for the school that has it, so a
 * third school that differs from VŠE is one more row, not a new kind of check.
 * MENDELU has every feature. VŠE and ČZU are prototype builds and today have
 * the same set: what is not general UIS (audits: research/czu-dump,
 * research/vse-dump). Why each is MENDELU's own:
 * - campusMap (the map, room-to-map buttons), erasmus: MENDELU data;
 * - canteenMenu: skm.mendelu.cz, which the build does not swap;
 * - successRates, similarSubjects: reis-data, scraped from MENDELU only;
 * - internships: bundled MENDELU partners, which match any faculty called "PEF";
 * - facultySearchScope: the workplace ids are MENDELU's;
 * - bulletin (Vývěska), teamsOutlook: not general enough to keep (Dominik, 2026-11-13);
 * - novinky, reports, partners, adminConsole, impersonation: Supabase rows,
 *   which a non-MENDELU build is cut off from;
 * - eduroam (MENDELU's RADIUS server), welcome (its eduroam set-up),
 *   studyDocuments, practiceTests: MENDELU only;
 * - storeRating ("Ohodnotit reIS"): the store listings are MENDELU's reIS;
 * - guides (Nápověda): reisapp.cz's guides describe MENDELU's IS, eduroam
 *   and ISIC;
 * - usageCounts: the daily install count and the feature counters, Supabase
 *   rows like the ones above. Off, nothing is even attempted: a VŠE build
 *   sends nothing to reIS (docs/privacy-policy-vse.md).
 */
export const ALL_FEATURES = [
  'campusMap',
  'erasmus',
  'canteenMenu',
  'successRates',
  'similarSubjects',
  'internships',
  'facultySearchScope',
  'bulletin',
  'teamsOutlook',
  'novinky',
  'reports',
  'partners',
  'adminConsole',
  'impersonation',
  'eduroam',
  'welcome',
  'studyDocuments',
  'practiceTests',
  'storeRating',
  'guides',
  'usageCounts',
] as const;

export type Feature = (typeof ALL_FEATURES)[number];

export type SchoolId = 'mendelu' | 'vse' | 'czu';

/**
 * A school with its own store listing. The manifest name and description come
 * from here (scripts/isHostSwap.ts); a school without one is a prototype build.
 * MENDELU has none: its listing is the manifest literal in wxt.config.ts.
 */
export interface SchoolListing {
  /** Manifest and store name. Users search for it, so it barely ever changes. */
  name: string;
  /** Manifest description, at most 132 characters (the Chrome Web Store's limit). */
  description: string;
  /** The policy text, in this repo. */
  privacyPolicyDoc: string;
  /** Where it is published, pasted into the store's privacy form. */
  privacyPolicyUrl: string;
}

/**
 * Not published yet. `npm run zip:vse` and the ship job refuse to make a store
 * zip while this is still the placeholder: publish docs/privacy-policy-vse.md
 * (a gist, like MENDELU's policy) and put its URL here first.
 */
export const VSE_PRIVACY_POLICY_URL = 'TODO: gist URL';

export interface SchoolProfile {
  id: SchoolId;
  /** The IS host every `is.mendelu.cz` in the bundle and manifest becomes. */
  host: string;
  name: string;
  features: Readonly<Record<Feature, boolean>>;
  /**
   * The domain of a student's school address, `<IS username>@<domain>`. Null
   * where nobody has confirmed the format: the profile then shows no address
   * rather than a guessed one.
   */
  emailDomain: string | null;
  listing: SchoolListing | null;
}

const everything = Object.fromEntries(ALL_FEATURES.map((f) => [f, true])) as Record<
  Feature,
  boolean
>;

/** General UIS only: every MENDELU-only feature off. */
const generalUis = Object.fromEntries(ALL_FEATURES.map((f) => [f, false])) as Record<
  Feature,
  boolean
>;

export const SCHOOL_PROFILES: Readonly<Record<SchoolId, SchoolProfile>> = {
  mendelu: {
    id: 'mendelu',
    host: 'is.mendelu.cz',
    name: 'MENDELU',
    features: everything,
    emailDomain: 'mendelu.cz',
    listing: null,
  },
  vse: {
    id: 'vse',
    host: 'insis.vse.cz',
    name: 'VŠE',
    features: generalUis,
    // Not confirmed by a VŠE student yet (no VŠE account on the team).
    emailDomain: null,
    listing: {
      // No "neoficiální" in the name (Dominik, 2026-11-17); the description says it.
      name: 'reIS pro VŠE',
      description:
        'Přehlednější InSIS: rozvrh, zkoušky, předměty a soubory na jednom místě. Neoficiální studentský projekt, s VŠE nesouvisí.',
      privacyPolicyDoc: 'docs/privacy-policy-vse.md',
      privacyPolicyUrl: VSE_PRIVACY_POLICY_URL,
    },
  },
  czu: {
    id: 'czu',
    host: 'is.czu.cz',
    name: 'ČZU',
    features: generalUis,
    emailDomain: null,
    listing: null,
  },
};

export const isSchoolId = (value: string): value is SchoolId =>
  Object.prototype.hasOwnProperty.call(SCHOOL_PROFILES, value);
