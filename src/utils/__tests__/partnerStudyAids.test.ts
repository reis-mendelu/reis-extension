import { describe, it, expect } from 'vitest';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { PARTNER_STUDY_AIDS, type PartnerStudyAids } from '../../data/partnerStudyAids';
import { matchingPartners } from '../partnerAudience';
import { studyAidsFor } from '../partnerStudyAids';

// mendelu.app is a partner whose audience the admin console sets by faculty and
// programme, exactly like EY's: `af:B-ATE` shows it to that programme alone.
const mendeluApp = {
  ...BUNDLED_SOCIETIES.ey!,
  id: 'mendelu-app',
  name: 'mendelu.app',
  audience: ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'],
};
const other = { ...BUNDLED_SOCIETIES.ey!, id: 'other', name: 'Other', sortOrder: 90 };
const list: PartnerStudyAids[] = [
  {
    partnerId: 'other',
    url: 'https://other.example/',
    clickSignal: 'study_aids_click_mendelu_app',
  },
  {
    partnerId: 'mendelu-app',
    url: 'https://mendelu.app/',
    clickSignal: 'study_aids_click_mendelu_app',
  },
];

describe('studyAidsFor', () => {
  it("gives a student the study aids of their own partner, in the partners' order", () => {
    expect(studyAidsFor([mendeluApp, other], list)?.url).toBe('https://mendelu.app/');
    expect(studyAidsFor([other], list)?.url).toBe('https://other.example/');
  });

  it('is null when no partner matches, so no row is shown', () => {
    expect(studyAidsFor([], list)).toBeNull();
  });

  it('skips a matching partner that has no study aids (EY has Stáže, not this)', () => {
    expect(studyAidsFor([BUNDLED_SOCIETIES.ey!], list)).toBeNull();
  });
});

describe('who the admin console can point mendelu.app at', () => {
  const catalog = { 'mendelu-app': mendeluApp };

  it('shows it to the listed programmes of the listed faculty only', () => {
    const shown = (facultyKey: 'af' | 'pef', programme: string | null) =>
      matchingPartners(catalog, { facultyKey, programme }).length === 1;
    expect(shown('af', 'B-ATE')).toBe(true);
    expect(shown('af', 'N-PTE')).toBe(true);
    expect(shown('af', 'B-ZIN')).toBe(true);
    // Another programme at the same faculty, and the same code elsewhere.
    expect(shown('af', 'B-FYT')).toBe(false);
    expect(shown('af', null)).toBe(false);
    expect(shown('pef', 'B-ATE')).toBe(false);
  });

  it('is shown to the whole faculty when the admin lists no programme', () => {
    const wholeFaculty = { 'mendelu-app': { ...mendeluApp, audience: ['af'] } };
    expect(matchingPartners(wholeFaculty, { facultyKey: 'af', programme: 'B-FYT' })).toHaveLength(
      1
    );
  });

  it('is not shown once the admin switches the partner off', () => {
    const off = { 'mendelu-app': { ...mendeluApp, isActive: false } };
    expect(matchingPartners(off, { facultyKey: 'af', programme: 'B-ATE' })).toEqual([]);
  });
});

describe('PARTNER_STUDY_AIDS', () => {
  it('has the one partner, and an https address that leaves the app', () => {
    expect(PARTNER_STUDY_AIDS.map((a) => a.partnerId)).toEqual(['mendelu-app']);
    for (const aids of PARTNER_STUDY_AIDS) expect(aids.url).toMatch(/^https:\/\//);
  });

  it('counts its click under a label of its own, never one shared with a partner programme', () => {
    expect(PARTNER_STUDY_AIDS[0]?.clickSignal).toBe('study_aids_click_mendelu_app');
  });
});
