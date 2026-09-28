import { Eye, MousePointerClick, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { SpolkyEventRow } from '../../api/societyPosts';

// What a society sees of its own event's reach: the two counters its
// `spolky_events` row already carries, which listMyPosts loads under the
// society's session, plus a third — interest — from the public RSVP
// aggregate. Nothing new is collected or requested for any of this.
//
// The three numbers are not the same kind of thing, and the note (below, for
// the first two) and the label (for the third) say so:
//   * view_count — once per DEVICE, when the Novinky row scrolls into view
//     (markNotificationViewed dedupes through IndexedDB);
//   * click_count — every tap on that row (useOpenNotification);
//   * interest — going + interested RSVPs. Not attendance: RSVPs count
//     installs, and free events see many no-shows — hence "v reIS"/"in reIS".
// None of these is "people". Map opens (event_map_views) are not here: that
// table is reis_admin-only, and exposing it needs its own society-scoped RPC.

const byId = (posts: SpolkyEventRow[], id: string) => posts.find((p) => p.id === id);

/** One rule for the row and the note: both counters, or nothing. */
const hasCounts = (
  post: SpolkyEventRow | undefined
): post is SpolkyEventRow & { view_count: number; click_count: number } =>
  typeof post?.view_count === 'number' && typeof post.click_count === 'number';

/** The counts line for one row, or nothing when the row has neither views/clicks nor interest. */
export function EventStats({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const post = useAppStore((s) => byId(s.societyPosts, eventId));
  const interest = useAppStore((s) => s.societyRsvpCounts[eventId]);
  const counted = hasCounts(post);
  // Interest is its own condition, independent of the "both counters or
  // nothing" rule below: an event can have RSVPs loaded before/without its
  // view and click counters (or the reverse), and each line stands on its own.
  if (!counted && !interest) return null;
  return (
    <span className="mt-0.5 flex items-center gap-2.5 text-[11px] text-base-content/70">
      {counted && (
        <>
          <span className="flex items-center gap-1">
            <Eye size={11} className="flex-shrink-0" aria-hidden />
            <span>
              {post.view_count === 1
                ? t('admin.eventViewsOne')
                : t('admin.eventViews', { count: post.view_count })}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <MousePointerClick size={11} className="flex-shrink-0" aria-hidden />
            <span>
              {post.click_count === 1
                ? t('admin.eventClicksOne')
                : t('admin.eventClicks', { count: post.click_count })}
            </span>
          </span>
        </>
      )}
      {interest && (
        <span className="flex items-center gap-1">
          <Users size={11} className="flex-shrink-0" aria-hidden />
          <span>{t('admin.eventInterest', { count: interest.going + interest.interested })}</span>
        </span>
      )}
    </span>
  );
}

/** The one-line key to the numbers, shown only when some listed row has them. */
export function EventStatsNote({ eventIds }: { eventIds: string[] }) {
  const { t } = useTranslation();
  const any = useAppStore((s) => eventIds.some((id) => hasCounts(byId(s.societyPosts, id))));
  if (!any) return null;
  return (
    <p className="px-3 pb-4 pt-3 text-[11px] text-base-content/70">{t('admin.eventStatsNote')}</p>
  );
}
