// The ledger shared by several server processes on one folder (S5's shape): adds that land
// together, changes that do not overwrite each other, and a cap that holds across processes.
import { describe, it, expect } from 'vitest';
import { createLedger } from '../storeLedger';
import { storeHarness } from './storeTestKit';

const { open } = storeHarness();
const NOW = Date.parse('2026-12-01T10:00:00Z');
const TODAY = '2026-12-01';
const ev = (over: Record<string, unknown> = {}) => ({
  title: 'Zápočtový test 1',
  kind: 'credit_test',
  date: '2026-12-10',
  time: '09:00',
  code: 'EBC-PE',
  source_kind: 'student',
  ...over,
});
const ledgerOn = (store: ReturnType<typeof open>, max?: number) =>
  createLedger(store, () => NOW, max);

describe('the ledger across processes', () => {
  it('lands both adds when two run at once, in this process and in another', async () => {
    const a = ledgerOn(open());
    const b = ledgerOn(open());
    await Promise.all([
      a.add(ev({ time: '08:00' }), TODAY),
      a.add(ev({ time: '09:00' }), TODAY),
      b.add(ev({ time: '10:00' }), TODAY),
    ]);
    expect((await ledgerOn(open()).list()).entries.map((e) => e.time)).toEqual([
      '08:00',
      '09:00',
      '10:00',
    ]);
  });

  it('keeps both changes when two processes update different fields of one entry', async () => {
    const a = ledgerOn(open());
    const b = ledgerOn(open());
    const { entry } = await a.add(ev(), TODAY);
    const rounds = Array.from({ length: 6 }, (_, i) => i);
    await Promise.all(
      rounds.flatMap((i) => [
        a.update(entry.id, { room: `Q0${i}` }),
        b.update(entry.id, { points: `${i}` }),
      ])
    );
    // Whichever change came last in each field is kept, and neither field was lost with a stale copy.
    const got = (await ledgerOn(open()).list()).entries[0]!;
    expect(got.room).toMatch(/^Q0\d$/);
    expect(got.points).toMatch(/^\d$/);
    await Promise.all([a.update(entry.id, { depends_on: 'A' }), b.update(entry.id, { rule: 'B' })]);
    expect((await ledgerOn(open()).list()).entries[0]).toMatchObject({
      dependsOn: 'A',
      rule: 'B',
    });
  });

  it('counts the cap across processes: two adds at the limit let one in', async () => {
    const a = ledgerOn(open(), 3);
    const b = ledgerOn(open(), 3);
    await a.add(ev({ date: '2026-12-10' }), TODAY);
    await a.add(ev({ date: '2026-12-11' }), TODAY);
    const results = await Promise.allSettled([
      a.add(ev({ date: '2026-12-12' }), TODAY),
      b.add(ev({ date: '2026-12-13' }), TODAY),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await ledgerOn(open()).list()).entries).toHaveLength(3);
  });
});
