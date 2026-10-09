import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planKind, deleteFingerprint, type PlanInput } from '../plan';
import type { DesiredEvent, ExistingEvent, ReisKind } from '../types';

type Raw = {
  name: string;
  input: Omit<PlanInput, 'desired' | 'existing'> & {
    desired: { id: string; date: string; hash: string }[];
    existing: { id: string; date: string; hash: string }[];
  };
  expected: { insert: string[]; update: string[]; remove: string[]; held: string | null };
};
const cases: Raw[] = JSON.parse(
  readFileSync(resolve(__dirname, '../__fixtures__/lessonPlans.json'), 'utf8')
);

describe('planKind (golden fixture)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const kind = c.input.kind as ReisKind;
    const desired = c.input.desired.map(
      (d) => ({ ...d, kind, body: {} }) as unknown as DesiredEvent
    );
    const existing = c.input.existing.map((e) => ({ ...e, kind }) as ExistingEvent);
    const p = planKind({ ...c.input, kind, desired, existing });
    expect({
      insert: p.insert.map((d) => d.id),
      update: p.update.map((d) => d.id),
      remove: p.remove,
      held: p.held,
    }).toEqual(c.expected);
  });
});

describe('deleteFingerprint', () => {
  it('is order-independent', () => {
    expect(deleteFingerprint(['b', 'a'])).toBe(deleteFingerprint(['a', 'b']));
  });
});
