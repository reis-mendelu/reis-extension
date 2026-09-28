import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sampleRow = {
  id: 'e1',
  association_id: 'supef',
  title: 'T',
  body: 'B',
  url: 'http://x',
  created_at: '2026-07-01T00:00:00Z',
  date: '2026-07-10',
  end_date: null,
};

const fallbackRow = {
  id: 'e2',
  association_id: 'supef',
  title: 'Fallback Title',
  body: null,
  url: null,
  created_at: '2026-07-02T00:00:00Z',
  date: '2026-07-11',
  end_date: null,
};

const from = vi.fn();
const select = vi.fn();
const lte = vi.fn();
const or = vi.fn();
const order = vi.fn();
const limit = vi.fn();

function makeBuilder() {
  const builder = {
    select: (...args: unknown[]) => {
      select(...args);
      return builder;
    },
    lte: (...args: unknown[]) => {
      lte(...args);
      return builder;
    },
    or: (...args: unknown[]) => {
      or(...args);
      return builder;
    },
    order: (...args: unknown[]) => {
      order(...args);
      return builder;
    },
    limit: (...args: unknown[]) => {
      limit(...args);
      return Promise.resolve({ data: [sampleRow, fallbackRow], error: null });
    },
  };
  return builder;
}

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      from(...args);
      return makeBuilder();
    },
  },
}));

import { fetchNotifications } from '../spolkyService';
import { localTodayIso } from '../../../components/CampusMap/eventWindow';

describe('fetchNotifications (repointed to spolky_events)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 9, 30, 0));
    from.mockClear();
    select.mockClear();
    lte.mockClear();
    or.mockClear();
    order.mockClear();
    limit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries spolky_events bounded to the soon horizon, keeping trips still running', async () => {
    const result = await fetchNotifications();

    const today = localTodayIso();
    const nowIso = new Date().toISOString();
    const visible = `or(visible_from.is.null,visible_from.lte.${nowIso})`;

    expect(from).toHaveBeenCalledWith('spolky_events');
    // Bounded to the soon horizon (today + 13 days) so an unbounded semester of
    // events can't push a small society's next event off the 200-row cap.
    expect(lte).toHaveBeenCalledWith('date', '2026-10-11');
    // ONE .or() with nested and(): a trip still running (end_date >= today)
    // stays even if it started before today.
    expect(or).toHaveBeenCalledTimes(1);
    expect(or).toHaveBeenCalledWith(
      `and(date.gte.${today},${visible}),and(end_date.gte.${today},${visible})`
    );
    expect(order).toHaveBeenCalledWith('date', { ascending: true });
    expect(limit).toHaveBeenCalledWith(200);

    expect(result).toEqual([
      {
        id: 'e1',
        associationId: 'supef',
        title: 'T',
        body: 'B',
        link: 'http://x',
        createdAt: '2026-07-01T00:00:00Z',
        expiresAt: '2026-07-10',
        startsAt: '2026-07-10',
        priority: 'normal',
      },
      {
        id: 'e2',
        associationId: 'supef',
        title: 'Fallback Title',
        body: 'Fallback Title',
        link: undefined,
        createdAt: '2026-07-02T00:00:00Z',
        expiresAt: '2026-07-11',
        startsAt: '2026-07-11',
        priority: 'normal',
      },
    ]);
  });
});
