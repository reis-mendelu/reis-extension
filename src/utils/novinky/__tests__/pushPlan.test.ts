import { describe, it, expect } from 'vitest';
import { planPushes, type PushRow } from '../pushPlan';

const row = (id: string, kind: PushRow['kind'], title: string, body = ''): PushRow => ({
  id,
  kind,
  title,
  body,
});

const none = new Set<string>();

describe('planPushes: Novinky rows → system notifications, 1:1', () => {
  it('records everything silently the first time, so an update posts no backlog', () => {
    const rows = [row('a', 'terms', 'VWA'), row('b', 'societies', 'Deskovky')];
    const plan = planPushes(rows, undefined, none);
    expect(plan.post).toEqual([]);
    expect(plan.notified).toEqual(['a', 'b']);
  });

  it('posts a row the device has not notified yet, and records it', () => {
    const plan = planPushes([row('a', 'terms', 'VWA'), row('b', 'terms', 'MNG')], ['a'], none);
    expect(plan.post).toEqual([{ kind: 'terms', rows: [row('b', 'terms', 'MNG')] }]);
    expect(plan.notified).toEqual(['a', 'b']);
  });

  it('groups a sync’s rows into one notification per kind', () => {
    const plan = planPushes(
      [
        row('t1', 'terms', 'VWA'),
        row('t2', 'terms', 'MNG'),
        row('p1', 'points', 'Java'),
        row('s1', 'societies', 'Deskovky'),
      ],
      [],
      none
    );
    expect(plan.post.map((p) => [p.kind, p.rows.length])).toEqual([
      ['terms', 2],
      ['points', 1],
      ['societies', 1],
    ]);
  });

  it('does not post what the student already saw in Novinky', () => {
    const plan = planPushes([row('a', 'boxes', 'Matlab')], [], new Set(['a']));
    expect(plan.post).toEqual([]);
    expect(plan.notified).toEqual(['a']);
  });

  it('keeps only the most recent ids, so the record cannot grow without end', () => {
    const old = Array.from({ length: 600 }, (_, i) => `old-${i}`);
    const plan = planPushes([row('new', 'terms', 'VWA')], old, none);
    expect(plan.notified).toHaveLength(500);
    expect(plan.notified.at(-1)).toBe('new');
  });
});
