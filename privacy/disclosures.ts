// THE SOURCE of what reIS sends and how every store and policy describes it.
//
// Change a data flow → change it here in the same PR. `privacy:check` (a test in
// the required Unit tests job) fails when the code, the Firefox manifest, the
// iOS/Android permissions, the privacy policy table or the Play CSV disagree
// with this file. The release PR's privacy checklist is generated from the diff
// of this file since the last v* tag. See docs/superpowers/specs/
// 2026-09-25-privacy-disclosures-source-design.md.
//
// Store values are the stores' OWN vocabulary, copied from what was live on
// 2026-09-25: Apple's App Privacy types, Play's CSV response ids, Firefox's
// data_collection categories, the Chrome Web Store's data-usage labels.

export interface AppleType {
  type: string;
  purpose: 'App Functionality' | 'Analytics';
  linked: boolean;
  tracking: false;
}

export interface Flow {
  id: string;
  what: string;
  when: 'background' | 'student-action';
  identifier: 'install_id' | 'none' | 'contact';
  /**
   * `direct`: the device sends it straight to a third party (the library's
   * Microsoft Bookings), never through reIS's Supabase. Its `files` and `calls`
   * then name that code and endpoint, and are not held to the Supabase checks;
   * its store declarations and policy rows are.
   */
  transport?: 'supabase' | 'direct';
  /** Files under src/ that make this flow's Supabase calls (or, `direct`, its requests). */
  files: string[];
  /** RPC or table names this flow uses (or, `direct`, the endpoints). */
  calls: string[];
  /** Rows of the "What we do send" table in docs/privacy-policy-app.md: [what, when, carries]. */
  policyRows: Array<[string, string, string]>;
  stores: { apple: AppleType[]; play: string[]; firefox: string[]; cws: string[] };
}

export interface Exempt {
  call: string;
  files: string[];
  why: string;
}

const INSTALL_ID_APPLE: AppleType = {
  type: 'User ID',
  purpose: 'Analytics',
  linked: true,
  tracking: false,
};

export const FLOWS: Flow[] = [
  {
    id: 'daily_count',
    what: 'One row per install per day: random install id, school, faculty, base study-programme code, platform and app version labels.',
    when: 'background',
    identifier: 'install_id',
    files: ['src/api/feedback.ts'],
    calls: ['track_daily_usage_v2'],
    policyRows: [
      [
        'Daily count',
        'once a day',
        'a random install identifier — a UUID that stays the same on this installation and is not derived from you; your name, student number or IS account are never sent with it. Counts **installs, not people**, plus school (e.g. MENDELU), faculty, study programme (e.g. B-OI), platform and app version (e.g. 5.4.1) as group labels. The feature counters below carry the same identifier, so in our database all of these records, on any day, can be matched to one another and to these labels per installation. Novinky questions do not.',
      ],
    ],
    stores: {
      apple: [INSTALL_ID_APPLE],
      play: ['PSL_USER_ACCOUNT'],
      firefox: ['technicalAndInteraction'],
      cws: ['User activity'],
    },
  },
  {
    id: 'report',
    what: 'A report the student writes: type, title, message, optional contact, screen, app version, browser, viewport, the platform and OS version it was sent from (no device model), and the school whose IS it was sent from.',
    when: 'student-action',
    identifier: 'contact',
    files: ['src/api/suggestions.ts'],
    calls: ['submit_suggestion_v4'],
    policyRows: [
      [
        'Feedback',
        'you press send',
        'your message, any contact detail you type, the screen name, app version, browser, window size, platform and OS version (no device model), and the school whose IS you sent it from (e.g. MENDELU)',
      ],
    ],
    stores: {
      apple: [
        { type: 'Customer Support', purpose: 'App Functionality', linked: true, tracking: false },
        { type: 'Email Address', purpose: 'App Functionality', linked: true, tracking: false },
      ],
      play: ['PSL_OTHER_MESSAGES', 'PSL_EMAIL'],
      firefox: ['personalCommunications', 'personallyIdentifyingInfo'],
      cws: ['Personally identifiable information'],
    },
  },
  {
    id: 'report_attachments',
    what: 'Only what the student adds to a report: a picked screenshot (re-encoded JPEG), and — only if the student chooses it (a box on an idea, the "Odeslat s technickými údaji" button on a bug) — the cleaned error/warning log with environment and sync flags. Kept 2 years, then deleted automatically; sooner on request.',
    when: 'student-action',
    identifier: 'contact',
    files: ['src/api/suggestions.ts'],
    calls: ['submit_suggestion_v4'],
    policyRows: [
      [
        'Report attachments',
        'only what you add to a report, when you press send',
        'a **screenshot you pick** yourself, re-encoded on your device so photo metadata and location are removed; and, **only if you choose it** (tick the box, or press *Send with technical details* on a bug report), the recent reIS errors and warnings from this session, with link parameters, email addresses, long numbers and coordinates already blanked out, plus platform, OS version, language and sync status. **Not linked to the install identifier.**',
      ],
    ],
    stores: {
      apple: [
        { type: 'Photos or Videos', purpose: 'App Functionality', linked: true, tracking: false },
        {
          type: 'Other Diagnostic Data',
          purpose: 'App Functionality',
          linked: true,
          tracking: false,
        },
        { type: 'Crash Data', purpose: 'App Functionality', linked: false, tracking: false },
      ],
      play: ['PSL_PHOTOS', 'PSL_PERFORMANCE_DIAGNOSTICS', 'PSL_CRASH_LOGS'],
      firefox: ['websiteContent', 'technicalAndInteraction'],
      cws: ['Website content'],
    },
  },
  {
    id: 'society_post_counters',
    what: 'A view or click counter on a society post; the post id and nothing else.',
    when: 'student-action',
    identifier: 'none',
    files: ['src/services/spolky/spolkyService.ts'],
    calls: ['increment_post_view', 'increment_post_click'],
    policyRows: [['Society post view or click', 'you open one', 'a post id']],
    stores: { apple: [], play: [], firefox: ['technicalAndInteraction'], cws: [] },
  },
  {
    id: 'map_event_views',
    what: 'A per-event, per-day map view counter; the event id and no identifier.',
    when: 'student-action',
    identifier: 'none',
    files: ['src/api/featureUsage.ts'],
    calls: ['increment_event_map_view'],
    policyRows: [
      [
        'Map event opened',
        'you open an event on the campus map',
        "that event's id and nothing else — a counter on the event, with no identifier of yours attached",
      ],
    ],
    stores: { apple: [], play: [], firefox: ['technicalAndInteraction'], cws: [] },
  },
  {
    id: 'questions',
    what: 'A per-question, per-day counter of devices that saw a Novinky question and of the button tapped; the question id and the button key, no identifier.',
    when: 'student-action',
    identifier: 'none',
    files: ['src/api/questions.ts'],
    calls: ['count_question'],
    policyRows: [
      [
        'Novinky question seen or answered',
        'a question from reIS is on your screen in Novinky, or you tap one of its buttons',
        "that question's id and which button you tapped — a counter on the question, with no identifier of yours attached. Your device remembers that it answered; we cannot tell who did",
      ],
    ],
    stores: { apple: [], play: [], firefox: ['technicalAndInteraction'], cws: [] },
  },
  {
    id: 'feature_counters',
    what: 'Nineteen feature counters on the random install id and the school label, one whitelisted label each: seven feature uses (one a tap on a partner programme card in Stáže, one a tap on the new-version row in Novinky, one a tap on the study-aids link under Předměty) and twelve screens opened.',
    when: 'background',
    identifier: 'install_id',
    files: ['src/api/featureUsage.ts'],
    calls: ['track_feature_usage_v2'],
    policyRows: [
      [
        'Map used for 3 seconds',
        'at most once a day, after three seconds on the map',
        'the random install identifier, the school and the fixed `map_dwell_3s` label',
      ],
      [
        'eduroam network configured',
        'the app itself saves the eduroam network (phone)',
        'the random install identifier, the school and the fixed `eduroam_wifi_configured` label',
      ],
      [
        'eduroam profile handed over',
        'a profile is prepared for you to install (Mac, Windows)',
        'the random install identifier, the school and the fixed `eduroam_profile_delivered` label. We cannot see whether you go on to install it',
      ],
      [
        'Week view used',
        'when the calendar shows the week (phone, iPad), once per app session; stored as one row per install per day',
        'the random install identifier, the school and the fixed `calendar_week_view` label',
      ],
      [
        'Screen opened',
        'when the calendar, Zkoušky, Předměty, Studijní plán, Jídelníček, search, Vývěska, Novinky, Doklady, ISIC, the library card on the map or Stáže is shown, once per app session (again only if a send fails); stored as one row per install, per screen, per day',
        'the random install identifier, the school and one fixed label naming the screen (`screen_calendar`, `screen_subjects`, `screen_menu`, `screen_search`, `screen_bulletin`, `screen_notifications`, `screen_internships`, `screen_exams`, `screen_study_plan`, `screen_documents`, `screen_isic`, `screen_library`) — nothing about what was on it, what you searched for or how long you stayed',
      ],
      [
        'Study room booked',
        'you book a study room from the library card on the map (mobile app), once per app session; stored as one row per install per day',
        'the random install identifier, the school and the fixed `library_booking_made` label. We never see which room, which hours or any booking detail, and the booking itself goes from your phone to the library, not through us',
      ],
      [
        'Partner programme opened',
        'you tap the card of a partner programme in Stáže (today only "Cesta s EY"), once per app session; stored as one row per install per day',
        'the random install identifier, the school and a fixed label naming the programme (`internship_click_ey`). We count how many installs tapped, which the partner is told as a number; we never tell the partner who, and we cannot see what you do on its website',
      ],
      [
        'New version opened',
        'you tap "Nová verze reISu" in Novinky (mobile app), once per app session; stored as one row per install per day',
        'the random install identifier, the school and the fixed `app_update_opened` label. We cannot see whether you go on to update',
      ],
      [
        'Study link opened',
        'you tap one of the links under Předměty that are shown only to students of the faculties and programmes reIS has chosen (today the "Studijní opory" link to mendelu.app, and the Discord server of your programme for Otevřená informatika and Administrace IS/ICT), once per app session; stored as one row per install per day',
        'the random install identifier, the school and a fixed label naming the link (`study_aids_click_mendelu_app`, `study_aids_click_discord_b_oi`, `study_aids_click_discord_b_aii`). We count how many installs tapped, which whoever runs the site may be told as a number; we never tell them who, and we cannot see what you do on the website or on Discord',
      ],
      [
        'reIS in Claude guide opened',
        'you open the guide from the "reIS v Claude" row in Novinky (browser extension, shown only to students of the programmes it launches to), once per app session; stored as one row per install per day',
        'the random install identifier, the school and the fixed `reis_for_claude_guide_opened` label. We cannot see whether you go on to install it, or anything you ask Claude',
      ],
      [
        'Fixed version explained',
        'reIS marked your version as broken by a change in IS and the mobile app shows the window explaining it (at most twice), or you tap its Update button or the one on an empty Předměty or Zkoušky, once per app session; stored as one row per install per day',
        'the random install identifier, the school and one fixed label (`critical_update_shown`, `critical_update_opened`). We cannot see whether you go on to update',
      ],
    ],
    stores: {
      // Which screens an install opened is "how the user interacts with the
      // app" in both stores' own words (Apple Product Interaction, Play App
      // interactions), linked through the same install id.
      apple: [
        INSTALL_ID_APPLE,
        { type: 'Product Interaction', purpose: 'Analytics', linked: true, tracking: false },
      ],
      play: ['PSL_USER_ACCOUNT', 'PSL_USER_INTERACTION'],
      firefox: ['technicalAndInteraction'],
      cws: ['User activity'],
    },
  },
  {
    id: 'library_booking',
    what: "A library study-room booking (phone and iPad only): the student's name, MENDELU e-mail, student number and faculty code, and a \"reIS\" note, sent from the device straight to the library's Microsoft Bookings (MENDELU's tenant) when the student books or cancels. Looking at free hours sends only rooms and dates.",
    when: 'student-action',
    identifier: 'contact',
    transport: 'direct',
    files: ['src/mobile/library/createBooking.ts', 'src/mobile/library/cancelBooking.ts'],
    calls: ['bookings.cloud.microsoft/appointments'],
    policyRows: [
      [
        'Library study-room booking (mobile app only)',
        'you book or cancel a study room',
        "your name, MENDELU e-mail, student number and faculty code, sent from your device straight to the library's Microsoft Bookings (MENDELU's tenant), never through reIS",
      ],
    ],
    stores: {
      apple: [
        { type: 'Name', purpose: 'App Functionality', linked: true, tracking: false },
        { type: 'Email Address', purpose: 'App Functionality', linked: true, tracking: false },
        { type: 'User ID', purpose: 'App Functionality', linked: true, tracking: false },
      ],
      play: ['PSL_NAME', 'PSL_EMAIL', 'PSL_USER_ACCOUNT'],
      firefox: [],
      cws: [],
    },
  },
  {
    id: 'store_version_check',
    what: "Whether a newer reIS is in the store (phone and iPad only), at start and on return to the app. iOS: a request to Apple's public App Store lookup with the app's bundle id and the Czech store. Android: asked of the Play Store app on the phone. Nothing about the student.",
    when: 'background',
    identifier: 'none',
    transport: 'direct',
    files: ['src/mobile/appUpdate.ts'],
    calls: ['itunes.apple.com/lookup'],
    policyRows: [
      [
        'Checking for a newer version (mobile app only)',
        'the app starts or you return to it',
        "iPhone and iPad: reIS's app id, to Apple's public App Store lookup. Android: the Play Store app on your phone is asked. Nothing about you; the store sees your device's IP address, as it does for any app",
      ],
    ],
    stores: { apple: [], play: [], firefox: [], cws: [] },
  },
];

/** Supabase calls that carry no student data flow, each with the reason. */
export const EXEMPT: Exempt[] = [
  {
    call: 'spolky_events',
    files: [
      'src/api/mapEvents.ts',
      'src/services/spolky/spolkyService.ts',
      'src/api/societyPosts.ts',
    ],
    why: 'Public society feed reads; writes are by reIS staff or a society login, never a student.',
  },
  {
    call: 'societies',
    files: ['src/api/societies.ts', 'src/api/societiesAdmin.ts'],
    why: 'Public society catalog read (names, colours, logo paths); writes are by a signed-in reis_admin, not a student.',
  },
  {
    call: 'map_pins',
    files: ['src/api/mapEvents.ts'],
    why: 'Public read of the live society pins on the map; written by reIS staff in Supabase, never a student.',
  },
  {
    call: 'venues',
    files: ['src/api/venues.ts'],
    why: 'Public read of the venues on the map (hours, menu, photo paths); written by reIS staff in Supabase, never a student.',
  },
  {
    call: 'is_notice_mutes',
    files: ['src/api/isNoticeMutes.ts', 'src/api/isNoticeMutesAdmin.ts'],
    why: 'Public read of the whole list of IS notices reIS muted, filtered on the device: the request says nothing about what the student’s IS shows them, which never leaves the device. Writes are by a signed-in reis_admin, never a student.',
  },
  {
    call: 'reis_questions',
    files: ['src/api/questions.ts', 'src/api/adminQuestions.ts'],
    why: 'Public read of the live Novinky questions; writes are by a signed-in reis_admin, never a student.',
  },
  {
    call: 'study_aids',
    files: ['src/api/studyAids.ts', 'src/api/adminStudyAids.ts'],
    why: 'Public read of which faculties and programmes each link under Předměty (study aids, programme Discord servers) is shown to, matched on the device: the lookup does not send the student’s faculty or programme. Writes are by a signed-in reis_admin, never a student.',
  },
  {
    call: 'critical_app_version',
    files: ['src/api/criticalVersion.ts'],
    why: 'Public read of the one critical app version reIS set after a breaking IS change, compared on the device: the request does not send the app’s own version. Set by reIS with SQL, never by a student or the app.',
  },
  {
    call: 'question_results',
    files: ['src/api/adminQuestions.ts'],
    why: 'Admin console read, signed-in reis_admin.',
  },
  {
    call: 'usage_stats',
    files: ['src/api/usageStats.ts'],
    why: 'Admin console read, signed-in reis_admin.',
  },
  {
    call: 'usage_retention',
    files: ['src/api/usageRetention.ts'],
    why: 'Admin console read, signed-in reis_admin.',
  },
  {
    call: 'usage_programmes',
    files: ['src/api/usageProgrammes.ts'],
    why: 'Admin console read, signed-in reis_admin.',
  },
  {
    call: 'school_stats',
    files: ['src/api/schoolStats.ts'],
    why: 'Admin console read, signed-in reis_admin: aggregates of data already collected, groups under 10 hidden.',
  },
  {
    call: 'feature_stats',
    files: ['src/api/featureStats.ts'],
    why: 'Admin console read, signed-in reis_admin.',
  },
  {
    call: 'suggestions',
    files: ['src/api/suggestionsAdmin.ts'],
    why: 'Admin inbox read and status update, signed-in reis_admin.',
  },
  {
    call: 'suggestion_attachments',
    files: ['src/api/suggestionsAdmin.ts'],
    why: 'Admin inbox read, signed-in reis_admin.',
  },
  {
    call: 'spolky_accounts',
    files: ['src/api/societyAccounts.ts', 'src/store/slices/createAdminSlice.ts'],
    why: 'Admin/society account lookups, signed-in accounts only.',
  },
];

/**
 * Schools with a store listing of their own (`listing` in
 * src/utils/schoolProfiles.ts) and a policy of their own: which of the FLOWS
 * above each one sends. An empty list is a promise that the build sends
 * nothing anywhere but the school's IS, so the school may have no feature on
 * (privacyDisclosures.test.ts). Turning one on means writing its flows here,
 * rewriting its policy and redoing its store's privacy form, in the same PR.
 */
export const SCHOOL_LISTING_FLOWS: Record<string, string[]> = {
  // docs/privacy-policy-vse.md: "neposílá nic nikam jinam než do InSIS".
  vse: [],
};

export const PLATFORM_PERMISSIONS = {
  /** Info.plist NS*UsageDescription keys. */
  ios: ['NSCameraUsageDescription'],
  /**
   * What the merged release manifest requests (app manifest + every Capacitor
   * plugin's, minus tools:node="remove"), without the android.permission. prefix.
   * RECEIVE_BOOT_COMPLETED and WAKE_LOCK come from @capacitor/local-notifications,
   * which stays for the exam-opening reminders (spec 2026-10-20): scheduled on
   * the phone from its own exam list, nothing sent anywhere.
   * ACCESS_NETWORK_STATE is the Android background check's (BackgroundCheckService):
   * JobScheduler needs it to run the job only when the phone is online. That
   * job asks IS Mendelu, with the sign-in the student already gave the app, for
   * new exam terms, odevzdávárny and záznamník points while reIS is closed, and
   * shows them as notifications; nothing it reads goes anywhere else.
   */
  android: [
    'INTERNET',
    'ACCESS_NETWORK_STATE',
    'POST_NOTIFICATIONS',
    'ACCESS_WIFI_STATE',
    'CHANGE_WIFI_STATE',
    'RECEIVE_BOOT_COMPLETED',
    'WAKE_LOCK',
  ],
};
