import { SCHOOL_PROFILES, isSchoolId } from './schoolProfiles';
import type { Feature, SchoolId, SchoolProfile } from './schoolProfiles';

export interface School {
  id: SchoolId;
  host: string;
  name: string;
  has(feature: Feature): boolean;
}

export function schoolFor(profile: SchoolProfile): School {
  return {
    id: profile.id,
    host: profile.host,
    name: profile.name,
    has: (feature) => profile.features[feature],
  };
}

const built: string = import.meta.env.VITE_REIS_SCHOOL ?? 'mendelu';

/**
 * The school this build is for. `VITE_REIS_SCHOOL` is set at build time by
 * `REIS_SCHOOL=vse|czu` (scripts/isHostSwap.ts); every real build is MENDELU.
 * Gate a school-specific capability on `currentSchool.has(feature)`, never on
 * the id: the profile table in utils/schoolProfiles.ts is the one place that
 * says what a school has.
 *
 * Only the resolution below is build-time. Resolving from the IS host the page
 * is on instead means replacing this one constant (and the literal folding in
 * scripts/isHostSwap.ts); callers keep `id`, `host` and `has`.
 */
export const currentSchool: School = schoolFor(
  SCHOOL_PROFILES[isSchoolId(built) ? built : 'mendelu']
);
