import { SCHOOL_PROFILES, isSchoolId } from './schoolProfiles';
import type { Feature, SchoolId, SchoolProfile } from './schoolProfiles';

export interface School {
  id: SchoolId;
  host: string;
  name: string;
  has(feature: Feature): boolean;
  /** The student's school address for an IS username, or '' where the format is unknown. */
  emailFor(username: string | undefined): string;
}

export function schoolFor(profile: SchoolProfile): School {
  return {
    id: profile.id,
    host: profile.host,
    name: profile.name,
    has: (feature) => profile.features[feature],
    emailFor: (username) =>
      username && profile.emailDomain ? `${username}@${profile.emailDomain}` : '',
  };
}

const built: string = import.meta.env.VITE_REIS_SCHOOL ?? 'mendelu';

/**
 * The school this build is for. `VITE_REIS_SCHOOL` is set at build time by
 * `REIS_SCHOOL=vse|czu` (scripts/isHostSwap.ts); unset, it is MENDELU. Each
 * school ships as its own build. Gate a school-specific capability on
 * `currentSchool.has(feature)`, never on the id: the profile table in
 * utils/schoolProfiles.ts is the one place that says what a school has.
 */
export const currentSchool: School = schoolFor(
  SCHOOL_PROFILES[isSchoolId(built) ? built : 'mendelu']
);
