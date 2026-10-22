import { describe, it, expect } from 'vitest';
import { visibleQuestions } from '../questionVisibility';
import type { Question } from '../../types/questions';

const q = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  promptCz: 'Chceš X?',
  promptEn: 'Want X?',
  noteCz: null,
  noteEn: null,
  buttons: [{ key: 'yes', cz: 'Ano', en: 'Yes' }],
  startsAt: '2026-10-25T08:00:00Z',
  endsAt: '2026-11-25T08:00:00Z',
  faculties: null,
  ...over,
});
const NOW = Date.parse('2026-11-01T12:00:00Z');

describe('visibleQuestions', () => {
  it('shows a live question to everyone when it has no faculties', () => {
    expect(visibleQuestions([q()], { nowMs: NOW, facultyKey: null }).map((x) => x.id)).toEqual([
      'q1',
    ]);
  });

  // The list comes from a cache as well as a fetch, so time is judged here.
  it('hides one that has not started or has ended', () => {
    const list = [
      q({ id: 'early', startsAt: '2026-11-02T00:00:00Z' }),
      q({ id: 'over', endsAt: '2026-11-01T00:00:00Z' }),
    ];
    expect(visibleQuestions(list, { nowMs: NOW, facultyKey: 'pef' })).toEqual([]);
  });

  it('targets by faculty on the device, and hides a targeted one from an unknown faculty', () => {
    const list = [q({ faculties: ['pef'] })];
    expect(visibleQuestions(list, { nowMs: NOW, facultyKey: 'pef' })).toHaveLength(1);
    expect(visibleQuestions(list, { nowMs: NOW, facultyKey: 'af' })).toHaveLength(0);
    expect(visibleQuestions(list, { nowMs: NOW, facultyKey: null })).toHaveLength(0);
  });

  it('keeps an undateable question out rather than showing it forever', () => {
    expect(visibleQuestions([q({ endsAt: 'garbage' })], { nowMs: NOW, facultyKey: null })).toEqual(
      []
    );
  });
});
