import { describe, it, expect } from 'vitest';
import { STUDY_AIDS, type StudyAidsEntry } from '../../data/studyAids';
import { studyAidsFor } from '../studyAids';

// The study-aids link is not a society or a company: who sees it is one row of
// `study_aids`, which the admin console edits (faculty and programme tokens like
// `af:B-ATE`, the same shape a partner's audience has).
const mendeluApp: StudyAidsEntry = {
  id: 'mendelu-app',
  url: 'https://mendelu.app/',
  clickSignal: 'study_aids_click_mendelu_app',
};
const other: StudyAidsEntry = {
  id: 'other',
  url: 'https://other.example/',
  clickSignal: 'study_aids_click_mendelu_app',
};
const list = [other, mendeluApp];
const audiences = { 'mendelu-app': ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'] };

describe('studyAidsFor', () => {
  const shown = (facultyKey: 'af' | 'pef' | null, programme: string | null) =>
    studyAidsFor(audiences, { facultyKey, programme }, list)?.id;

  it('shows the link to the listed programmes of the listed faculty only', () => {
    expect(shown('af', 'B-ATE')).toBe('mendelu-app');
    expect(shown('af', 'N-PTE')).toBe('mendelu-app');
    expect(shown('af', 'B-ZIN')).toBe('mendelu-app');
    // Another programme at the same faculty, no programme, the code elsewhere.
    expect(shown('af', 'B-FYT')).toBeUndefined();
    expect(shown('af', null)).toBeUndefined();
    expect(shown('pef', 'B-ATE')).toBeUndefined();
    expect(shown(null, 'B-ATE')).toBeUndefined();
  });

  it('shows it to a whole faculty when the admin lists no programme', () => {
    expect(
      studyAidsFor({ 'mendelu-app': ['af'] }, { facultyKey: 'af', programme: 'B-FYT' }, list)?.id
    ).toBe('mendelu-app');
  });

  it('shows it to everyone when the admin picks the whole university', () => {
    expect(
      studyAidsFor({ 'mendelu-app': ['mendelu'] }, { facultyKey: 'pef', programme: 'B-OI' }, list)
        ?.id
    ).toBe('mendelu-app');
  });

  it('shows nothing while no audience is known or the admin has switched it off', () => {
    // Switched off, or not loaded yet: the row is simply absent. Fail closed.
    expect(studyAidsFor({}, { facultyKey: 'af', programme: 'B-ATE' }, list)).toBeNull();
  });

  it('skips an entry without an audience row and takes the next that has one', () => {
    expect(
      studyAidsFor({ other: ['pef'] }, { facultyKey: 'pef', programme: 'B-OI' }, list)?.id
    ).toBe('other');
  });
});

describe('STUDY_AIDS', () => {
  it('is mendelu.app, an https address that leaves the app', () => {
    expect(STUDY_AIDS.map((a) => a.id)).toEqual(['mendelu-app']);
    for (const aids of STUDY_AIDS) expect(aids.url).toMatch(/^https:\/\//);
  });

  it('counts its click under a label of its own', () => {
    expect(STUDY_AIDS[0]?.clickSignal).toBe('study_aids_click_mendelu_app');
  });
});
