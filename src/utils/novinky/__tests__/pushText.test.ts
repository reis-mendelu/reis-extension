import { describe, it, expect } from 'vitest';
import { pushRowsOf, pushText } from '../pushText';
import type { DeadlineAlert } from '../../../hooks/useDeadlineAlerts';
import type { SpolekNotification } from '../../../services/spolky/types';

const alert = (id: string, type: DeadlineAlert['type'], title: string, body: string) =>
  ({ id, type, title, body, courseCode: 'EBC-X' }) as DeadlineAlert;

const event = (id: string, title: string, associationId = 'supef') =>
  ({ id, title, body: '', associationId }) as SpolekNotification;

describe('pushRowsOf: which Novinky rows are notified', () => {
  const alerts = [
    alert('t', 'exam-new-term', 'VWA', 'zkouška · 14. 12.'),
    alert('p', 'zaznamnik-points', 'Java', 'Test 1: 9'),
    alert('b', 'assignment-new', 'Matlab', 'Projekt'),
    // The dated rows are notified at their own time (scheduled, PR 2), not when
    // they appear in the list a week ahead.
    alert('m', 'exam-registered', 'MNG', 'zápočet · Q01'),
    alert('o', 'exam-reg-opens', 'MNG', 'zápočet'),
  ];
  const nameOf = () => 'SU PEF';

  it('takes the news rows and the society rows', () => {
    const rows = pushRowsOf(alerts, [event('e', 'Deskovky')], nameOf);
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['t', 'terms'],
      ['p', 'points'],
      ['b', 'boxes'],
      ['e', 'societies'],
    ]);
    expect(rows.at(-1)).toMatchObject({ title: 'Deskovky', body: 'SU PEF' });
  });
});

describe('pushText: one notification per kind', () => {
  const t = (key: string, p?: Record<string, string>) =>
    `${key}${p?.subject ? `(${p.subject})` : ''}`;

  it('names the one subject and keeps the row’s own line', () => {
    const one = {
      kind: 'terms' as const,
      rows: [{ id: 't', kind: 'terms' as const, title: 'VWA', body: 'zkouška · 14. 12.' }],
    };
    expect(pushText(one, t)).toEqual({
      title: 'novinkyPush.termsOne(VWA)',
      body: 'zkouška · 14. 12.',
    });
  });

  it('lists the subjects when several arrive together, each once', () => {
    const rows = ['VWA', 'MNG', 'VWA'].map((title, i) => ({
      id: `${i}`,
      kind: 'terms' as const,
      title,
      body: '',
    }));
    expect(pushText({ kind: 'terms', rows }, t)).toEqual({
      title: 'novinkyPush.termsMany',
      body: 'VWA, MNG',
    });
  });

  it('a single society row is the event itself', () => {
    const one = {
      kind: 'societies' as const,
      rows: [{ id: 'e', kind: 'societies' as const, title: 'Deskovky', body: 'SU PEF' }],
    };
    expect(pushText(one, t)).toEqual({ title: 'Deskovky', body: 'SU PEF' });
  });
});
