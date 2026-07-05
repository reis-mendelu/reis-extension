import { z } from 'zod';
import type { SpolekNotification, AssociationProfile } from './types';
import { FACULTY_TO_ASSOCIATION, ASSOCIATION_PROFILES } from './config';
import { supabase } from './supabaseClient';
import { logError } from '../../utils/reportError';

// Runtime shape of a `spolky_events` row used by the notification feed. Supabase
// results are `any`-typed, so we validate before rendering user-facing content
// rather than trusting the DB.
const NotificationRowSchema = z.object({
  id: z.string(),
  association_id: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string().nullable(),
  created_at: z.string(),
  date: z.string(),
  end_date: z.string().nullable(),
});

/**
 * Track that notifications were viewed (when bell icon opened)
 * @param notificationIds - IDs of notifications that were viewed
 */
export async function trackNotificationsViewed(notificationIds: string[]): Promise<void> {
  if (!notificationIds || notificationIds.length === 0) return;

  try {
    // Call Supabase RPC to increment view counts for each notification
    // We use Promise.all to run them in parallel
    await Promise.all(
      notificationIds.map((id) => supabase.rpc('increment_post_view', { row_id: id }))
    );
  } catch (error) {
    logError('Spolky.trackNotificationsViewed', error);
  }
}

/**
 * Track that a notification was clicked
 * @param notificationId - ID of the notification that was clicked
 */
export async function trackNotificationClick(notificationId: string): Promise<void> {
  if (!notificationId) return;

  try {
    await supabase.rpc('increment_post_click', { row_id: notificationId });
  } catch (error) {
    logError('Spolky.trackNotificationClick', error);
  }
}

/**
 * Fetch all active notifications from Supabase
 */
export async function fetchNotifications(): Promise<SpolekNotification[]> {
  try {
    const { data, error } = await supabase
      .from('spolky_events')
      .select('id, association_id, title, body, url, created_at, date, end_date')
      .gte('date', new Date().toISOString().slice(0, 10))
      .or('visible_from.is.null,visible_from.lte.' + new Date().toISOString())
      .order('date', { ascending: true })
      .limit(50);

    if (error) {
      return [];
    }

    const parsed = z.array(NotificationRowSchema).safeParse(data ?? []);
    if (!parsed.success) {
      logError('Spolky.fetchNotifications', parsed.error);
      return [];
    }

    return parsed.data.map((n) => ({
      id: n.id,
      associationId: n.association_id,
      title: n.title,
      body: n.body || n.title,
      link: n.url || undefined,
      createdAt: n.created_at,
      expiresAt: n.end_date || n.date, // events use their date as natural expiry
      priority: 'normal' as const,
    }));
  } catch {
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
