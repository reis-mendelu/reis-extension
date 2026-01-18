import type { SpolekNotification, AssociationProfile } from './types';
import { FACULTY_TO_ASSOCIATION, ASSOCIATION_PROFILES } from './config';
import { supabase } from './supabaseClient';

// ... rest of imports

/**
 * Track that notifications were viewed (when bell icon opened)
 * @param notificationIds - IDs of notifications that were viewed
 */
export async function trackNotificationsViewed(notificationIds: string[]): Promise<void> {
  try {
    // Call Supabase RPC to increment view counts
    // Note: Requires 'increment_view_count' function in Supabase
    await Promise.all(
      notificationIds.map((id) =>
        supabase.rpc('increment_view_count', { notification_id: id })
      )
    );
  } catch (error) {
    // Fail silently if analytics fail (or if RPC function is missing)
    console.error('[SpolkyService] Failed to track views:', error);
  }
}

/**
 * Track that a notification was clicked
 * @param notificationId - ID of the notification that was clicked
 */
export async function trackNotificationClick(notificationId: string): Promise<void> {
  try {
    // Call Supabase RPC to increment click count
    // Note: Requires 'increment_click_count' function in Supabase
    await supabase.rpc('increment_click_count', { notification_id: notificationId });
  } catch (error) {
    console.error('[SpolkyService] Failed to track click:', error);
  }
}

/**
 * Fetch all active notifications from Supabase
 */
export async function fetchNotifications(): Promise<SpolekNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SpolkyService] Supabase error:', error);
      return [];
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      associationId: n.association_id,
      title: n.title,
      body: n.body || n.title,
      link: n.link || undefined,
      createdAt: n.created_at,
      expiresAt: n.expires_at,
      priority: n.priority as 'normal' | 'high'
    }));
  } catch (error) {
    console.error('[SpolkyService] Failed to fetch notifications:', error);
    return [];
  }
}

/**
 * Determine user's association based on their faculty
 * @param facultyId - User's faculty ID (e.g., 'PEF')
 * @returns AssociationProfile or null if not found
 */
export function getUserAssociation(facultyId: string | null): AssociationProfile | null {
  if (!facultyId) return null;
  
  const associationId = FACULTY_TO_ASSOCIATION[facultyId as keyof typeof FACULTY_TO_ASSOCIATION];
  if (!associationId) return null;
  
  return ASSOCIATION_PROFILES[associationId] || null;
}

/**
 * Filter notifications relevant to user's faculty
 * @param notifications - All notifications
 * @param facultyId - User's faculty ID
 * @param isErasmus - Whether user is Erasmus+ student
 * @param optedInAssociations - List of manually subscribed association IDs
 * @returns Filtered notifications
 */
export function filterNotificationsByFaculty(
  notifications: SpolekNotification[],
  subscribedAssociations: string[] = []
): SpolekNotification[] {
  return notifications.filter((n) => {
    const assocId = n.associationId;

    // 1. Always show Admin / Academic notifications
    if (!assocId || assocId === 'admin' || assocId.startsWith('academic_')) return true;

    // 2. Show if subscribed (handled by useSpolkySettings defaults + user choice)
    return subscribedAssociations.includes(assocId);
  });
}


