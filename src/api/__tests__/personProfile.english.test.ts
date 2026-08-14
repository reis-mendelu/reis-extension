import { describe, it, expect } from 'vitest';
import { parsePersonProfile } from '../personProfile';
import { TEACHER_PROFILE_HTML } from '../../test/fixtures/personProfileTeacher';
import {
  TEACHER_PROFILE_HTML_EN,
  STUDENT_PROFILE_HTML_EN,
} from '../../test/fixtures/personProfileEnglish';

// #206: clovek.pl was fetched with lang=cz unconditionally, so an English user
// read Czech roles, departments and study lines. The fix flips the request to
// the app language — which is only safe if the parser reads BOTH pages, because
// every contact label and both study sentences are translated. These tests pin
// that: the same fields the Czech fixtures assert, asserted again in English.

describe('parsePersonProfile on the English page', () => {
  describe('staff', () => {
    const profile = parsePersonProfile(TEACHER_PROFILE_HTML_EN, 18583)!;

    it('parses at all', () => {
      expect(profile).not.toBeNull();
      expect(profile.name).toBe('Ing. David Procházka, Ph.D.');
    });

    it('reads the roles in English', () => {
      expect(profile.roles).toHaveLength(2);
      expect(profile.roles[0]).toBe('Assistant Professor - Department of Informatics (FBE)');
      expect(profile.roles[1]).toContain('External Instructor');
    });

    // The four labelled rows are the whole point of #206's risk: each label is
    // a different English string, and a Czech-only lookup silently yields null.
    it('reads the labelled contact rows behind their English labels', () => {
      expect(profile.phone).toBe('+420 500 000 000');
      expect(profile.workplace).toBe('DI FBE, Zemědělská 1, 61300 Brno');
      expect(profile.consultationHours).toContain('Bookings');
    });

    it('still extracts both office keys', () => {
      expect(profile.officeCode).toBe('BA39N2056');
      expect(profile.officeName).toBe('Q2.56');
    });

    it('reads the university e-mail through the language-invariant anchor', () => {
      expect(profile.universityEmail).toBe('david.prochazka@mendelu.cz');
    });

    it('has no study lines', () => {
      expect(profile.programmeCode).toBeNull();
      expect(profile.studyTypeSentence).toBeNull();
      expect(profile.yearSemesterSentence).toBeNull();
    });
  });

  describe('student', () => {
    const profile = parsePersonProfile(STUDENT_PROFILE_HTML_EN, 120349)!;

    it('parses the programme', () => {
      expect(profile).not.toBeNull();
      expect(profile.programmeCode).toBe('B0613A140025');
      expect(profile.programmeName).toBe('Open Informatics B-OI');
    });

    // "Bachelor type of study, full-time form" — no Czech word in sight, and
    // "1st"/"2nd" carry ordinal suffixes that a `\d+\.` pattern never matches.
    it('reads the English study sentences', () => {
      expect(profile.studyTypeSentence).toBe('Bachelor type of study, full-time form');
      expect(profile.yearSemesterSentence).toBe('1st year of study / 2nd semester of study');
    });

    it('does not mistake the study-code line for a study sentence', () => {
      // "FBE B-OI-ZBOI pres [term 2, year 1]" contains "year" and a comma; it
      // is not the sentence we want and must not win either match.
      expect(profile.studyTypeSentence).not.toContain('ZBOI');
      expect(profile.yearSemesterSentence).not.toContain('ZBOI');
    });

    it('has no staff fields', () => {
      expect(profile.roles).toEqual([]);
      expect(profile.officeCode).toBeNull();
      expect(profile.phone).toBeNull();
    });
  });

  // The Czech page must keep working identically — this is the regression that
  // a bilingual parser could plausibly introduce.
  it('leaves the Czech page unchanged', () => {
    const cz = parsePersonProfile(TEACHER_PROFILE_HTML, 18583)!;
    expect(cz.phone).toBe('+420 500 000 000');
    expect(cz.workplace).toBe('ÚI PEF, Zemědělská 1, 61300 Brno');
    expect(cz.consultationHours).toContain('Bookings');
    expect(cz.officeCode).toBe('BA39N2056');
    expect(cz.officeName).toBe('Q2.56');
    expect(cz.roles[0]).toContain('Akademický pracovník');
  });
});
