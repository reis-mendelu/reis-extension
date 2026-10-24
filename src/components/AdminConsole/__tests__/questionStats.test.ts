import { describe, it, expect } from 'vitest';
import { dailyTable, questionStats, questionStatus } from '../questionStats';
import type { QuestionResult } from '../../../api/adminQuestions';

const q: QuestionResult = {
  id: 'q1',
  promptCz: 'Chceš X?',
  promptEn: 'Want X?',
  noteCz: null,
  noteEn: null,
  buttons: [
    { key: 'yes', cz: 'Ano', en: 'Yes' },
    { key: 'no', cz: 'Ne', en: 'No' },
    { key: 'open', cz: 'Otevřít', en: 'Open', url: 'https://x.example' },
  ],
  startsAt: '2026-10-25T08:00:00Z',
  endsAt: '2026-11-22T08:00:00Z',
  faculties: null,
  totals: { seen: 200, yes: 30, no: 10, open: 50 },
  daily: [
    { day: '2026-10-26', key: 'yes', n: 5 },
    { day: '2026-10-25', key: 'seen', n: 120 },
  ],
};

describe('questionStats', () => {
  it('shares of seen and of answered, with link taps outside the answers', () => {
    const s = questionStats(q);
    expect(s.seen).toBe(200);
    expect(s.answered).toBe(40);
    expect(s.buttons.find((b) => b.key === 'yes')).toMatchObject({
      ofSeen: 0.15,
      ofAnswered: 0.75,
    });
    expect(s.buttons.find((b) => b.key === 'open')).toMatchObject({
      isLink: true,
      ofAnswered: null,
    });
    expect(s.suspicious).toBe(false);
  });

  it('flags more answers than views', () => {
    expect(questionStats({ ...q, totals: { seen: 3, yes: 9 } }).suspicious).toBe(true);
  });

  // A link tap counts seen first too, so more clicks than views is also spoofing.
  it('flags more link clicks than views', () => {
    expect(questionStats({ ...q, totals: { seen: 3, open: 9 } }).suspicious).toBe(true);
  });

  it('has no shares before anyone saw it', () => {
    expect(questionStats({ ...q, totals: {} }).buttons[0]?.ofSeen).toBeNull();
  });

  it('knows scheduled, live and ended', () => {
    expect(questionStatus(q, Date.parse('2026-10-24T00:00:00Z'))).toBe('scheduled');
    expect(questionStatus(q, Date.parse('2026-11-01T00:00:00Z'))).toBe('live');
    expect(questionStatus(q, Date.parse('2026-11-22T08:00:00Z'))).toBe('ended');
  });

  it('lays the days out in order, seen first, zeros filled', () => {
    expect(dailyTable(q)).toEqual({
      keys: ['seen', 'yes', 'no', 'open'],
      rows: [
        { day: '2026-10-25', counts: [120, 0, 0, 0] },
        { day: '2026-10-26', counts: [0, 5, 0, 0] },
      ],
    });
  });
});
