// The ledger on disk (S5's shape): events survive a restart, forget removes them, the budget
// never evicts them, and two adds at once both land.
import { describe, it, expect } from 'vitest';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLedger } from '../storeLedger';
import * as realFs from 'node:fs/promises';
import type { StoreFs } from '../storeFs';
import { gate, storeHarness } from './storeTestKit';

const { h, open, leftovers } = storeHarness();
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

describe('the ledger store', () => {
  it('adds, lists soonest first, updates by id and removes', async () => {
    const l = ledgerOn(open());
    const later = (
      await l.add(ev({ title: 'Obhajoba', kind: 'defence', date: '2026-12-20' }), TODAY)
    ).entry;
    const sooner = (await l.add(ev(), TODAY)).entry;
    expect((await l.list()).entries.map((e) => e.id)).toEqual([sooner.id, later.id]);
    const changed = await l.update(sooner.id, { room: 'Q01', time: '' });
    expect(changed).toMatchObject({ id: sooner.id, room: 'Q01', savedAt: sooner.savedAt });
    expect(changed.time).toBeUndefined();
    expect(await l.remove(sooner.id)).toBe(true);
    expect(await l.remove(sooner.id)).toBe(false);
    expect((await l.list()).entries.map((e) => e.id)).toEqual([later.id]);
  });

  it('keeps the id across updates and uses a file per event', async () => {
    const l = ledgerOn(open());
    const { entry } = await l.add(ev(), TODAY);
    await l.update(entry.id, { points: '20' });
    expect(await readdir(join(h.dir, 'ledger'))).toEqual([`${entry.id}.json`]);
    expect(
      JSON.parse(await readFile(join(h.dir, 'ledger', `${entry.id}.json`), 'utf8'))
    ).toMatchObject({
      id: entry.id,
      points: '20',
    });
  });

  it('does not add the same event twice, it updates it', async () => {
    const l = ledgerOn(open());
    const first = await l.add(ev(), TODAY);
    const again = await l.add(ev({ room: 'Q02', rule: 'min. 12 bodů' }), TODAY);
    expect([first.created, again.created]).toEqual([true, false]);
    expect(again.entry).toMatchObject({ id: first.entry.id, room: 'Q02', rule: 'min. 12 bodů' });
    expect((await l.list()).entries).toHaveLength(1);
    // A different time on the same day is another event.
    await l.add(ev({ time: '13:00' }), TODAY);
    expect((await l.list()).entries).toHaveLength(2);
  });

  // Found in the real-connector walk: two credit tests of one subject, listed in one file with only a
  // week given, share subject, kind, day and file. They are two events; their titles tell them apart.
  it('keeps two events of one subject, kind, day and file apart by their title', async () => {
    const l = ledgerOn(open());
    const file = {
      source_kind: 'course_file',
      source_url: 'https://is.example/f?download=1',
      source_file: 'harmonogram.pdf',
      source_modified: '16.09.2026',
    };
    const a = await l.add(ev({ title: 'Zápočet HW skills', time: undefined, ...file }), TODAY);
    const b = await l.add(ev({ title: 'Zápočet Netacad', time: undefined, ...file }), TODAY);
    expect([a.created, b.created]).toEqual([true, true]);
    expect((await l.list()).entries).toHaveLength(2);
    // The same title in other case and spacing is still the same event.
    const again = await l.add(
      ev({ title: ' zápočet  HW SKILLS ', time: undefined, ...file }),
      TODAY
    );
    expect(again.created).toBe(false);
    expect((await l.list()).entries).toHaveLength(2);
  });

  it('stops at the cap, and says how to make room', async () => {
    const l = ledgerOn(open(), 3);
    for (const d of ['10', '11', '12']) await l.add(ev({ date: `2026-12-${d}` }), TODAY);
    await expect(l.add(ev({ date: '2026-12-13' }), TODAY)).rejects.toThrow(
      /holds 3 events.*remove/
    );
    expect((await l.list()).entries).toHaveLength(3);
  });

  it('lets a full ledger free itself of events that ended long ago', async () => {
    const l = ledgerOn(open(), 2);
    await l.add(ev({ date: '2026-09-01' }), '2026-09-02');
    await l.add(ev({ date: '2026-12-10' }), '2026-09-02');
    // Three months on, the September one is long past: the add makes room by dropping it.
    await l.add(ev({ date: '2026-12-11' }), TODAY);
    expect((await l.list()).entries.map((e) => e.date)).toEqual(['2026-12-10', '2026-12-11']);
  });

  it('keeps old events while there is room: only a full ledger drops them', async () => {
    const l = ledgerOn(open(), 5);
    await l.add(ev({ date: '2026-09-01' }), '2026-09-02');
    await l.add(ev({ date: '2026-12-11' }), TODAY);
    expect((await l.list()).entries.map((e) => e.date)).toEqual(['2026-09-01', '2026-12-11']);
  });

  it('finds every event even when index.json lost some: it reads the folder, not the index', async () => {
    const l = ledgerOn(open());
    const a = (await l.add(ev({ time: '08:00' }), TODAY)).entry;
    const b = (await l.add(ev({ time: '09:00' }), TODAY)).entry;
    // Two processes committing at once overwrite each other's index entry: simulate the loss.
    await writeFile(join(h.dir, 'index.json'), JSON.stringify({ version: 1, entries: {} }));
    const fresh = ledgerOn(open());
    expect((await fresh.list()).entries.map((e) => e.id)).toEqual([a.id, b.id]);
    // And the cap and the dedupe see them too: the same event is not added again.
    expect((await fresh.add(ev({ time: '08:00' }), TODAY)).created).toBe(false);
  });

  it('survives a restart: a second store on the same folder sees the events', async () => {
    const entry = (await ledgerOn(open()).add(ev(), TODAY)).entry;
    const restarted = ledgerOn(open());
    expect((await restarted.list()).entries).toEqual([entry]);
  });

  it('is removed by forget, with everything else', async () => {
    const store = open();
    const l = ledgerOn(store);
    await l.add(ev(), TODAY);
    await store.write('subjects.json', '{}');
    await store.forget();
    expect(await leftovers()).toEqual([]);
    expect((await l.list()).entries).toEqual([]);
  });

  it('cannot come back after forget: an add that forget overtakes is cancelled, even from another process', async () => {
    const held = gate();
    const reached = gate();
    const slow = {
      ...realFs,
      open: async (p: Parameters<typeof realFs.open>[0], ...a: unknown[]) => {
        // The add's own file is being written: hold it right there.
        if (String(p).includes('.tmp-') && !String(p).includes('.tmp-lock-')) {
          reached.release();
          await held.wait;
        }
        return (realFs.open as (...x: unknown[]) => unknown)(p, ...a);
      },
    } as StoreFs;
    const outcome = ledgerOn(open({ fs: slow }))
      .add(ev(), TODAY)
      .then(
        () => 'saved',
        (e: Error) => e.message
      );
    await reached.wait;
    await open().forget(); // another process forgets while the add is mid-write
    held.release();
    expect(await outcome).toMatch(/was not saved/);
    expect(await leftovers()).toEqual([]);
    expect((await ledgerOn(open()).list()).entries).toEqual([]);
  });

  it('cannot come back after forget: an add waiting its turn when forget runs is cancelled too', async () => {
    const held = gate();
    const reached = gate();
    let first = true;
    const slow = {
      ...realFs,
      open: async (p: Parameters<typeof realFs.open>[0], ...a: unknown[]) => {
        // Hold the first add mid-write, so the second one waits behind it.
        if (first && String(p).includes('.tmp-') && !String(p).includes('.tmp-lock-')) {
          first = false;
          reached.release();
          await held.wait;
        }
        return (realFs.open as (...x: unknown[]) => unknown)(p, ...a);
      },
    } as StoreFs;
    const l = ledgerOn(open({ fs: slow }));
    const settle = (p: Promise<unknown>) =>
      p.then(
        () => 'saved',
        (e: Error) => e.message
      );
    const ahead = settle(l.add(ev(), TODAY));
    await reached.wait;
    // Asked for before the forget; it only gets its turn after the forget is over.
    const queued = settle(l.add(ev({ title: 'Obhajoba', kind: 'defence' }), TODAY));
    await open().forget(); // another process forgets
    held.release();
    expect(await ahead).toMatch(/was not saved/);
    expect(await queued).toMatch(/was not saved/);
    expect(await leftovers()).toEqual([]);
    expect((await ledgerOn(open()).list()).entries).toEqual([]);
  });

  it('is never evicted by the size budget, only counted in it', async () => {
    const store = open({ maxBytes: 3000 });
    const l = ledgerOn(store);
    const { entry } = await l.add(ev(), TODAY);
    for (let i = 0; i < 6; i++) await store.write(`text/${i}.json`, 'x'.repeat(900));
    expect((await l.list()).entries.map((e) => e.id)).toEqual([entry.id]);
    expect((await store.list()).filter((e) => e.path.startsWith('text/')).length).toBeLessThan(6);
  });

  it('ignores a damaged file and says how many', async () => {
    const store = open();
    const l = ledgerOn(store);
    await l.add(ev(), TODAY);
    await store.write(
      'ledger/ev-aaaaaaaaaaaa.json',
      '{"id":"ev-aaaaaaaaaaaa","date":"2026-02-30"}'
    );
    const r = await l.list();
    expect([r.entries.length, r.unreadable]).toEqual([1, 1]);
  });

  it('refuses an id that is not one', async () => {
    const l = ledgerOn(open());
    await expect(l.update('../x', {})).rejects.toThrow(/event id/);
    await expect(l.remove('ev-zzz')).rejects.toThrow(/event id/);
    await expect(l.update('ev-0123456789ab', {})).rejects.toThrow(/No ledger entry/);
  });
});
