import { describe, expect, it } from 'vitest';
import { ALL_FEATURES, SCHOOL_PROFILES, isSchoolId } from '../schoolProfiles';
import { currentSchool, schoolFor } from '../school';

const featuresOf = (id: keyof typeof SCHOOL_PROFILES) =>
  ALL_FEATURES.filter((f) => SCHOOL_PROFILES[id].features[f]);

describe('school profiles', () => {
  it('MENDELU has every feature', () => {
    expect(featuresOf('mendelu')).toEqual([...ALL_FEATURES]);
  });

  it.each(['vse', 'czu'] as const)(
    '%s has only general UIS: none of the MENDELU-only features',
    (id) => {
      expect(featuresOf(id)).toEqual([]);
    }
  );

  it('VŠE and ČZU are the same set for now', () => {
    expect(SCHOOL_PROFILES.vse.features).toEqual(SCHOOL_PROFILES.czu.features);
  });

  it('names each school by its IS host', () => {
    expect(SCHOOL_PROFILES.mendelu.host).toBe('is.mendelu.cz');
    expect(SCHOOL_PROFILES.vse.host).toBe('insis.vse.cz');
    expect(SCHOOL_PROFILES.czu.host).toBe('is.czu.cz');
    for (const [id, profile] of Object.entries(SCHOOL_PROFILES)) expect(profile.id).toBe(id);
  });

  it('knows its own ids and nothing else', () => {
    expect(isSchoolId('vse')).toBe(true);
    expect(isSchoolId('muni')).toBe(false);
    expect(isSchoolId('toString')).toBe(false);
  });

  it('answers has() from the profile', () => {
    const vse = schoolFor(SCHOOL_PROFILES.vse);
    expect(vse.id).toBe('vse');
    expect(vse.host).toBe('insis.vse.cz');
    expect(vse.has('campusMap')).toBe(false);
    expect(schoolFor(SCHOOL_PROFILES.mendelu).has('campusMap')).toBe(true);
  });

  it("gives the student's school address only where its format is known", () => {
    expect(schoolFor(SCHOOL_PROFILES.mendelu).emailFor('xnovak')).toBe('xnovak@mendelu.cz');
    expect(schoolFor(SCHOOL_PROFILES.mendelu).emailFor('')).toBe('');
    // Never a MENDELU address for a VŠE student, and no guessed one either.
    expect(schoolFor(SCHOOL_PROFILES.vse).emailFor('xnovj01')).toBe('');
    expect(schoolFor(SCHOOL_PROFILES.czu).emailFor('xnovj01')).toBe('');
  });

  it('VŠE is its own listing, named "reIS pro VŠE"; ČZU is still a prototype', () => {
    const listing = SCHOOL_PROFILES.vse.listing;
    expect(listing?.name).toBe('reIS pro VŠE');
    expect(listing?.description.length).toBeLessThanOrEqual(132);
    expect(listing?.description).toMatch(/[Nn]eoficiální/);
    expect(listing?.description).not.toMatch(/mendelu/i);
    expect(listing?.privacyPolicyDoc).toBe('docs/privacy-policy-vse.md');
    expect(SCHOOL_PROFILES.czu.listing).toBeNull();
    // MENDELU's listing is the manifest literal in wxt.config.ts.
    expect(SCHOOL_PROFILES.mendelu.listing).toBeNull();
  });

  it('every real build (no VITE_REIS_SCHOOL) is MENDELU with everything', () => {
    expect(currentSchool.id).toBe('mendelu');
    expect(currentSchool.host).toBe('is.mendelu.cz');
    expect(ALL_FEATURES.every((f) => currentSchool.has(f))).toBe(true);
  });
});
