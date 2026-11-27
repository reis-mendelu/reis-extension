import { describe, it, expect } from 'vitest';
import { STUDY_AIDS, type StudyAidsEntry } from '../../data/studyAids';
import { studyAidsFor } from '../studyAids';

// A link under Předměty is not a society or a company: who sees it is one row of
// `study_aids`, which the admin console edits (faculty and programme tokens like
// `af:B-ATE`, the same shape a partner's audience has).
const entry = (id: string): StudyAidsEntry => ({
  id,
  url: `https://${id}.example/`,
  clickSignal: 'study_aids_click_mendelu_app',
  labelKey: 'subjects.studyAids',
  hintKey: 'subjects.studyAidsHint',
  icon: 'book',
});
const mendeluApp = entry('mendelu-app');
const other = entry('other');
const list = [other, mendeluApp];
const audiences = { 'mendelu-app': ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'] };

describe('studyAidsFor', () => {
  const shown = (facultyKey: 'af' | 'pef' | null, programme: string | null) =>
    studyAidsFor(audiences, { facultyKey, programme }, list).map((e) => e.id);

  it('shows the link to the listed programmes of the listed faculty only', () => {
    expect(shown('af', 'B-ATE')).toEqual(['mendelu-app']);
    expect(shown('af', 'N-PTE')).toEqual(['mendelu-app']);
    expect(shown('af', 'B-ZIN')).toEqual(['mendelu-app']);
    // Another programme at the same faculty, no programme, the code elsewhere.
    expect(shown('af', 'B-FYT')).toEqual([]);
    expect(shown('af', null)).toEqual([]);
    expect(shown('pef', 'B-ATE')).toEqual([]);
    expect(shown(null, 'B-ATE')).toEqual([]);
  });

  it('shows it to a whole faculty when the admin lists no programme', () => {
    expect(
      studyAidsFor({ 'mendelu-app': ['af'] }, { facultyKey: 'af', programme: 'B-FYT' }, list).map(
        (e) => e.id
      )
    ).toEqual(['mendelu-app']);
  });

  it('shows it to everyone when the admin picks the whole university', () => {
    expect(
      studyAidsFor(
        { 'mendelu-app': ['mendelu'] },
        { facultyKey: 'pef', programme: 'B-OI' },
        list
      ).map((e) => e.id)
    ).toEqual(['mendelu-app']);
  });

  it('shows nothing while no audience is known or the admin has switched it off', () => {
    // Switched off, or not loaded yet: the row is simply absent. Fail closed.
    expect(studyAidsFor({}, { facultyKey: 'af', programme: 'B-ATE' }, list)).toEqual([]);
  });

  it('shows every link whose audience matches, in the order the code lists them', () => {
    // A B-OI student can be in mendelu.app's audience and in their Discord's.
    expect(
      studyAidsFor(
        { other: ['pef:B-OI'], 'mendelu-app': ['pef'] },
        { facultyKey: 'pef', programme: 'B-OI' },
        list
      ).map((e) => e.id)
    ).toEqual(['other', 'mendelu-app']);
  });
});

describe('STUDY_AIDS', () => {
  const byId = (id: string) => STUDY_AIDS.find((a) => a.id === id);

  it('lists mendelu.app and the two programme Discord servers, all https', () => {
    expect(STUDY_AIDS.map((a) => a.id)).toEqual(['mendelu-app', 'discord-b-oi', 'discord-b-aii']);
    for (const aids of STUDY_AIDS) expect(aids.url).toMatch(/^https:\/\//);
  });

  it('points each Discord entry at its own invite', () => {
    expect(byId('discord-b-oi')?.url).toBe('https://discord.gg/fN9XrTqmVf');
    expect(byId('discord-b-aii')?.url).toBe('https://discord.gg/THue2RgVr2');
    expect(byId('discord-b-oi')?.icon).toBe('discord');
    expect(byId('discord-b-aii')?.icon).toBe('discord');
  });

  it('counts each link under a label of its own', () => {
    const signals = STUDY_AIDS.map((a) => a.clickSignal);
    expect(new Set(signals).size).toBe(signals.length);
    expect(byId('mendelu-app')?.clickSignal).toBe('study_aids_click_mendelu_app');
    expect(byId('discord-b-oi')?.clickSignal).toBe('study_aids_click_discord_b_oi');
    expect(byId('discord-b-aii')?.clickSignal).toBe('study_aids_click_discord_b_aii');
  });
});
