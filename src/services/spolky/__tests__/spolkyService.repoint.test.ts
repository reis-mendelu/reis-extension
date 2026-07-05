import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const rpc = vi.fn(async (..._args: unknown[]) => ({ data: null, error: null }));
const from = vi.fn();
vi.mock('../supabaseClient', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

import { trackNotificationsViewed, trackNotificationClick } from '../spolkyService';

describe('engagement tracking repoint', () => {
  beforeEach(() => rpc.mockClear());
  it('view tracking calls increment_post_view', async () => {
    await trackNotificationsViewed(['id1']);
    expect(rpc).toHaveBeenCalledWith('increment_post_view', { row_id: 'id1' });
  });
  it('click tracking calls increment_post_click', async () => {
    await trackNotificationClick('id2');
    expect(rpc).toHaveBeenCalledWith('increment_post_click', { row_id: 'id2' });
  });
});
