// Straight from the implementation files, not the barrel beside them (Iron Rule).
import { dropPastEvents, dropBeyondNovinkyWindow } from '../../services/spolky/spolkyService';
import type { SpolekNotification } from '../../services/spolky/types';
import type { AppState } from '../../store/types';
import { localTodayIso } from '../../components/CampusMap/eventWindow';
import { canSee, isReisOwn, type Viewer } from '../eventAudience';
import { viewerOf } from '../../hooks/useViewer';
import { isNoticeRows, pragueMinuteIso } from '../isNoticeRows';

/** reIS's own rows are for everyone, exchange students included. */
const isReisRow = (n: SpolekNotification) => isReisOwn(n.associationId);

/** What Novinky's society and MENDELU rows are built from. */
export interface FeedInputs {
  allNotifications: AppState['notifications']['data'];
  societies: AppState['societies'];
  viewer: Viewer;
  todayIso: string;
  nowMinute: string;
  isNotices: AppState['isNotices'];
  isNoticeMutes: AppState['isNoticeMutes'];
  language: AppState['language'];
}

/** The same inputs, read from a store snapshot: for code outside React (src/mobile). */
export const feedInputsOf = (s: AppState): FeedInputs => ({
  allNotifications: s.notifications.data,
  societies: s.societies,
  viewer: viewerOf(s),
  todayIso: localTodayIso(s.now),
  nowMinute: pragueMinuteIso(s.now),
  isNotices: s.isNotices,
  isNoticeMutes: s.isNoticeMutes,
  language: s.language,
});

/**
 * Novinky's society and MENDELU rows, on both trees, and the phone's system
 * notifications for them (src/mobile/novinkyNotifications): one list.
 *
 * Three questions: is the student in this event's audience (utils/eventAudience
 * — no follow list), has the event already happened, and is it within the
 * Novinky week? The list can come from `notifications_cache` in IndexedDB,
 * which is never re-examined, so without the second question a past event
 * stays in the feed. The week also holds back what the console lists as
 * "Naplánované" further out.
 */
export function buildFeed({
  allNotifications,
  societies,
  viewer,
  todayIso,
  nowMinute,
  isNotices,
  isNoticeMutes,
  language,
}: FeedInputs): SpolekNotification[] {
  return dropBeyondNovinkyWindow(
    dropPastEvents(
      [
        // The student's own IS notices lead, under MENDELU. They skip the
        // audience rule: IS already decided they are for this student.
        ...isNoticeRows(isNotices[language] ?? [], isNoticeMutes, todayIso, nowMinute),
        ...allNotifications.filter(
          (n) =>
            isReisRow(n) ||
            canSee(
              { societyId: n.associationId ?? '', subscribersOnly: n.subscribersOnly },
              societies,
              viewer
            )
        ),
      ],
      todayIso
    ),
    todayIso
  );
}
