import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackNotificationsViewed, trackNotificationClick } from './spolkyService';
import { supabase } from './supabaseClient';

// Mock the supabase client
vi.mock('./supabaseClient', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('spolkyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackNotificationsViewed', () => {
    it('should call increment_notification_view RPC for each notification ID', async () => {
      const notificationIds = ['id1', 'id2'];
      await trackNotificationsViewed(notificationIds);

      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(supabase.rpc).toHaveBeenCalledWith('increment_notification_view', { row_id: 'id1' });
      expect(supabase.rpc).toHaveBeenCalledWith('increment_notification_view', { row_id: 'id2' });
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
        
        expect(supabase.rpc).toHaveBeenCalledWith('increment_notification_view', { row_id: 'id1' });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
  });

  describe('trackNotificationClick', () => {
    it('should call increment_notification_click RPC for the notification ID', async () => {
      const notificationId = 'id1';
      await trackNotificationClick(notificationId);

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('increment_notification_click', { row_id: 'id1' });
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
        
        expect(supabase.rpc).toHaveBeenCalledWith('increment_notification_click', { row_id: 'id1' });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
  });
});
