import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackNotificationsViewed, trackNotificationClick } from './spolkyService';
import { supabase } from './supabaseClient';

const { hasDataConsent } = vi.hoisted(() => ({
  hasDataConsent: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
}));

// Firefox's data-consent toggle. Granted unless a test says otherwise, which is
// also what every non-Firefox browser and the apps answer.
vi.mock('../../utils/firefoxDataConsent', () => ({
  hasDataConsent: (...a: unknown[]) => hasDataConsent(...a),
}));

// Mock the supabase client
vi.mock('./supabaseClient', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('spolkyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasDataConsent.mockResolvedValue(true);
  });

  // A post id is not an identifier, but a view or click count is interaction
  // data in Mozilla's terms, and opening a post works without it.
  describe('on Firefox with the technical-data toggle off', () => {
    beforeEach(() => hasDataConsent.mockResolvedValue(false));

    it('sends no view counter', async () => {
      await trackNotificationsViewed(['id1', 'id2']);
      expect(hasDataConsent).toHaveBeenCalledWith('technicalAndInteraction');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('sends no click counter', async () => {
      await trackNotificationClick('id1');
      expect(hasDataConsent).toHaveBeenCalledWith('technicalAndInteraction');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('asks once for a batch of views, not once per post', async () => {
      await trackNotificationsViewed(['id1', 'id2', 'id3']);
      expect(hasDataConsent).toHaveBeenCalledTimes(1);
    });
  });

  describe('trackNotificationsViewed', () => {
    it('should call increment_post_view RPC for each notification ID', async () => {
      const notificationIds = ['id1', 'id2'];
      await trackNotificationsViewed(notificationIds);

      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(supabase.rpc).toHaveBeenCalledWith('increment_post_view', { row_id: 'id1' });
      expect(supabase.rpc).toHaveBeenCalledWith('increment_post_view', { row_id: 'id2' });
    });

    it('should not call RPC if notificationIds is empty', async () => {
      await trackNotificationsViewed([]);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle RPC errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any).mockRejectedValueOnce(new Error('RPC Error'));

      await trackNotificationsViewed(['id1']);

      expect(supabase.rpc).toHaveBeenCalledWith('increment_post_view', { row_id: 'id1' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('trackNotificationClick', () => {
    it('should call increment_post_click RPC for the notification ID', async () => {
      const notificationId = 'id1';
      await trackNotificationClick(notificationId);

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('increment_post_click', { row_id: 'id1' });
    });

    it('should not call RPC if notificationId is empty', async () => {
      await trackNotificationClick('');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
    it('should handle RPC errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any).mockRejectedValueOnce(new Error('RPC Error'));

      await trackNotificationClick('id1');

      expect(supabase.rpc).toHaveBeenCalledWith('increment_post_click', { row_id: 'id1' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
