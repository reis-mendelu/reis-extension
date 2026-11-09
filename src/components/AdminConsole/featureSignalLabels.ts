import type { FeatureSignal } from '../../api/featureUsage';

/** The `admin.stats.*` label each database key is shown under. Typed over the
 *  client's signals, so adding one without a label fails the typecheck. */
export const SIGNAL_LABEL_KEY: Record<FeatureSignal, string> = {
  map_dwell_3s: 'signalMapDwell',
  eduroam_wifi_configured: 'signalEduroamConfigured',
  eduroam_profile_delivered: 'signalEduroamDelivered',
  calendar_week_view: 'signalCalendarWeekView',
  screen_calendar: 'signalScreenCalendar',
  screen_subjects: 'signalScreenSubjects',
  screen_menu: 'signalScreenMenu',
  screen_search: 'signalScreenSearch',
  screen_bulletin: 'signalScreenBulletin',
  screen_notifications: 'signalScreenNotifications',
};
