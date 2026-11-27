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
  screen_exams: 'signalScreenExams',
  screen_study_plan: 'signalScreenStudyPlan',
  screen_documents: 'signalScreenDocuments',
  screen_isic: 'signalScreenIsic',
  screen_library: 'signalScreenLibrary',
  library_booking_made: 'signalLibraryBookingMade',
  screen_internships: 'signalScreenInternships',
  internship_click_ey: 'signalInternshipClickEy',
  app_update_opened: 'signalAppUpdateOpened',
  study_aids_click_mendelu_app: 'signalStudyAidsClickMendeluApp',
  study_aids_click_discord_b_oi: 'signalStudyAidsClickDiscordBOi',
  study_aids_click_discord_b_aii: 'signalStudyAidsClickDiscordBAii',
  reis_for_claude_guide_opened: 'signalReisForClaudeGuideOpened',
  critical_update_shown: 'signalCriticalUpdateShown',
  critical_update_opened: 'signalCriticalUpdateOpened',
};
