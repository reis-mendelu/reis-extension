import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const from = vi.fn();
const select = vi.fn();
const gte = vi.fn();
const or = vi.fn();
const order = vi.fn();
const limit = vi.fn();

function makeBuilder() {
  const builder = {
    select: (...args: unknown[]) => { select(...args); return builder; },
    gte: (...args: unknown[]) => { gte(...args); return builder; },
    or: (...args: unknown[]) => { or(...args); return builder; },
    order: (...args: unknown[]) => { order(...args); return builder; },
    limit: (...args: unknown[]) => { limit(...args); return Promise.resolve({ data: [sampleRow], error: null }); },
  };
  return builder;
}

vi.mock('../supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => { from(...args); return makeBuilder(); } },
}));

import { fetchNotifications } from '../spolkyService';

describe('fetchNotifications (repointed to spolky_events)', () => {
  beforeEach(() => {
    from.mockClear(); select.mockClear(); gte.mockClear(); or.mockClear(); order.mockClear(); limit.mockClear();
  });

  it('queries spolky_events with the upcoming-date filter and maps rows to notifications', async () => {
    const result = await fetchNotifications();

    expect(from).toHaveBeenCalledWith('spolky_events');
    expect(gte).toHaveBeenCalledWith('date', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(or).toHaveBeenCalledWith(expect.stringContaining('visible_from.is.null'));
    expect(order).toHaveBeenCalledWith('date', { ascending: true });

    expect(result).toEqual([
      {
        id: 'e1',
        associationId: 'supef',
        title: 'T',
        body: 'B',
        link: 'http://x',
        createdAt: '2026-07-01T00:00:00Z',
        expiresAt: '2026-07-10',
        priority: 'normal',
      },
    ]);
  });
});
