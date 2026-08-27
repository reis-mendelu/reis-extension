/**
 * Two small injector modules that were both at 0%.
 *
 * bgPokeListener is the receiving end of the background alarm. The alarm pokes
 * EVERY open is.mendelu.cz tab, so the discipline here is about not turning one
 * timer into N full crawls — and about answering the worker so its message
 * channel closes.
 *
 * fetchFullSemesterSchedule computes the same semester window as
 * services/sync/syncSchedule, independently and by hand. Two copies of a rule
 * that decides which weeks the timetable shows is exactly the sort of thing that
 * drifts, so the branches are pinned here too.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const requestSync = vi.hoisted(() => vi.fn());
const fetchDualLanguageSchedule = vi.hoisted(() => vi.fn());

vi.mock('../syncGate', () => ({ requestSync }));
vi.mock('../../api/schedule', () => ({ fetchDualLanguageSchedule }));

import { startBgPokeListener, BG_POKE_MESSAGE } from '../bgPokeListener';
import { fetchFullSemesterSchedule } from '../dataFetchers';

type Listener = (msg: unknown, sender: unknown, respond: (r: unknown) => void) => boolean;
let listeners: Listener[];

beforeEach(() => {
  vi.clearAllMocks();
  listeners = [];
  vi.stubGlobal('chrome', {
    runtime: { onMessage: { addListener: (l: Listener) => listeners.push(l) } },
  });
  fetchDualLanguageSchedule.mockResolvedValue([]);
});

describe('bgPokeListener', () => {
  function poke(msg: unknown) {
    startBgPokeListener();
    const respond = vi.fn();
    const returned = listeners.map((l) => l(msg, {}, respond));
    return { respond, keptOpen: returned.some((r) => r === true) };
  }

  it('asks for a sync with the poke reason', async () => {
    // The reason is not cosmetic: syncGate drops a 'poke' when the tab is in the
    // background, when a run happened recently, or when another tab holds the
    // lock. Passing anything else here turns one alarm into N full crawls.
    const { respond } = poke({ type: BG_POKE_MESSAGE });

    expect(requestSync).toHaveBeenCalledWith('poke');
    expect(respond).toHaveBeenCalledWith({ ok: true });
  });

  it('answers synchronously and does NOT hold the channel open', async () => {
    // The sync is deliberately not awaited — returning true would keep the
    // worker's message channel open for the length of a full crawl.
    const { keptOpen } = poke({ type: BG_POKE_MESSAGE });

    expect(keptOpen).toBe(false);
  });

  it('ignores messages of any other type', async () => {
    const { respond } = poke({ type: 'SOMETHING_ELSE' });

    expect(requestSync).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
  });

  it('survives a message with no type at all', async () => {
    expect(() => poke(null)).not.toThrow();
    expect(requestSync).not.toHaveBeenCalled();
  });
});

describe('fetchFullSemesterSchedule', () => {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  async function windowAt(y: number, m: number, d: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m - 1, d));
    await fetchFullSemesterSchedule();
    const arg = fetchDualLanguageSchedule.mock.calls[0]![0] as { start: Date; end: Date };
    return { start: iso(arg.start), end: iso(arg.end) };
  }

  afterEach(() => vi.useRealTimers());

  it('spans Sep 1 to Aug 31 of the NEXT year in the winter semester', async () => {
    expect(await windowAt(2026, 10, 15)).toEqual({ start: '2026-09-01', end: '2027-08-31' });
  });

  it('reaches back to the PREVIOUS September in the Jan/Feb transition', async () => {
    // January still belongs to the winter semester that began last September.
    expect(await windowAt(2026, 1, 20)).toEqual({ start: '2025-09-01', end: '2026-08-31' });
  });

  it('treats February as the transition, not the summer semester', async () => {
    expect(await windowAt(2026, 2, 14)).toEqual({ start: '2025-09-01', end: '2026-08-31' });
  });

  it('spans Feb 1 to Aug 31 of the same year in the summer semester', async () => {
    expect(await windowAt(2026, 4, 10)).toEqual({ start: '2026-02-01', end: '2026-08-31' });
  });

  it('treats September 1 as already winter', async () => {
    expect(await windowAt(2026, 9, 1)).toEqual({ start: '2026-09-01', end: '2027-08-31' });
  });

  it('returns whatever the API returned', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 10));
    fetchDualLanguageSchedule.mockResolvedValue([{ id: 'lesson' }]);

    await expect(fetchFullSemesterSchedule()).resolves.toEqual([{ id: 'lesson' }]);
  });
});
