import { describe, it, expect } from 'vitest';
import { parsePersonProfile } from '../personProfile';
import { TEACHER_PROFILE_HTML } from '../../test/fixtures/personProfileTeacher';

/**
 * The profile parser was written for students, so a teacher's page gave back a
 * name, an email and three nulls — the person sheet had nothing to show and
 * said so. Everything asserted here comes from a real `clovek.pl` response
 * (see the fixture's header for provenance).
 */
describe('parsePersonProfile — a staff page', () => {
  const profile = parsePersonProfile(TEACHER_PROFILE_HTML, 18583)!;

  it('still reads the fields it always read', () => {
    expect(profile.name).toBe('Ing. David Procházka, Ph.D.');
    expect(profile.universityEmail).toBe('david.prochazka@mendelu.cz');
    expect(profile.privateEmail).toBe('david.prochazka@gmail.com');
  });

  it('reads the role and its department', () => {
    // Role lines have no label column — they are bare rows in the header
    // table, recognised by the department anchor to pracoviste.pl.
    expect(profile.roles).toEqual([
      'Akademický pracovník - odborný asistent - Ústav informatiky (PEF)',
      'Externí školitel - Ústav hospodářské úpravy lesů a aplikované geoinformatiky (LDF)',
    ]);
  });

  it('reads the work phone and the workplace address', () => {
    expect(profile.phone).toBe('+420 545 132 240');
    expect(profile.workplace).toBe('ÚI PEF, Zemědělská 1, 61300 Brno');
  });

  it('reads BOTH office codes, because the map may key on either', () => {
    // The anchor text carries the estate code and the friendly name; the href
    // carries the friendly name on its own. The campus map's room index has
    // { code: "BA39N2056", name: "Q2.56" } and matches on either, so keeping
    // both is what makes "show me the office" resolve.
    expect(profile.officeCode).toBe('BA39N2056');
    expect(profile.officeName).toBe('Q2.56');
  });

  it('reads the consultation hours as text, links stripped', () => {
    expect(profile.consultationHours).toContain('Konzultaci si prosím rezervujte online přes');
  });

  it('leaves the student fields alone on a staff page', () => {
    expect(profile.programmeCode).toBeNull();
    expect(profile.studyTypeSentence).toBeNull();
  });
});

describe('parsePersonProfile — a page without any of it', () => {
  it('returns nulls rather than throwing when the contact table is absent', () => {
    const html = `<table><tbody><tr><td class="odsazena"><b><font size="+1">Jan Student</font></b></td></tr></tbody></table>`;
    const profile = parsePersonProfile(html, 1)!;

    expect(profile.name).toBe('Jan Student');
    expect(profile.officeCode).toBeNull();
    expect(profile.officeName).toBeNull();
    expect(profile.phone).toBeNull();
    expect(profile.roles).toEqual([]);
  });
});
