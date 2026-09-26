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
  /** Files under src/ that make this flow's Supabase calls. */
  files: string[];
  /** RPC or table names this flow uses. */
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
    what: 'One row per install per day: random install id, faculty and platform labels.',
    when: 'background',
    identifier: 'install_id',
    files: ['src/api/feedback.ts'],
    calls: ['track_daily_usage'],
    policyRows: [
      [
        'Daily count',
        'once a day',
        'a random install identifier — a UUID unrelated to you. Counts **installs, not people**, plus faculty and platform as group labels.',
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
    what: 'A report the student writes: type, title, message, optional contact, screen, app version, browser, viewport.',
    when: 'student-action',
    identifier: 'contact',
    files: ['src/api/suggestions.ts'],
    calls: ['submit_suggestion_v2'],
    policyRows: [
      [
        'Feedback',
        'you press send',
        'your message, any contact detail you type, the screen name, app version, browser, window size',
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
    what: 'Only what the student adds to a report: a picked screenshot (re-encoded JPEG), and — if ticked — the cleaned error/warning log with environment and sync flags. Kept 90 days or until resolved.',
    when: 'student-action',
    identifier: 'contact',
    files: ['src/api/suggestions.ts'],
    calls: ['submit_suggestion_v2'],
    policyRows: [
      [
        'Report attachments',
        'only what you add to a report, when you press send',
        'a **screenshot you pick** yourself, re-encoded on your device so photo metadata and location are removed; and, **only if you tick the box**, the recent reIS errors and warnings from this session, with link parameters, email addresses, long numbers and coordinates already blanked out, plus platform, OS version, language and sync status. **Not linked to the install identifier.**',
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
    id: 'survey_and_rsvp',
    what: 'An NPS answer, or an event RSVP, on the random install id.',
    when: 'student-action',
    identifier: 'install_id',
    files: ['src/api/feedback.ts', 'src/api/eventRsvp.ts'],
    calls: ['submit_feedback', 'set_event_rsvp'],
    policyRows: [
      ['In-app survey, event RSVP', 'you answer / RSVP', 'the same random install identifier'],
    ],
    stores: {
      apple: [INSTALL_ID_APPLE],
      play: ['PSL_USER_ACCOUNT'],
      firefox: ['technicalAndInteraction'],
      cws: ['User activity'],
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
    stores: { apple: [], play: [], firefox: [], cws: [] },
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
    stores: { apple: [], play: [], firefox: [], cws: [] },
  },
  {
    id: 'feature_counters',
    what: 'Three feature counters on the random install id, one whitelisted label each.',
    when: 'background',
    identifier: 'install_id',
    files: ['src/api/featureUsage.ts'],
    calls: ['track_feature_usage'],
    policyRows: [
      [
        'Map used for 3 seconds',
        'at most once a day, after three seconds on the map',
        'the random install identifier and the fixed `map_dwell_3s` label',
      ],
      [
        'eduroam network configured',
        'the app itself saves the eduroam network (phone)',
        'the random install identifier and the fixed `eduroam_wifi_configured` label',
      ],
      [
        'eduroam profile handed over',
        'a profile is prepared for you to install (Mac, Windows)',
        'the random install identifier and the fixed `eduroam_profile_delivered` label. We cannot see whether you go on to install it',
      ],
    ],
    stores: {
      apple: [INSTALL_ID_APPLE],
      play: ['PSL_USER_ACCOUNT'],
      firefox: ['technicalAndInteraction'],
      cws: ['User activity'],
    },
  },
];

/** Supabase calls that carry no student data flow, each with the reason. */
export const EXEMPT: Exempt[] = [
  {
    call: 'get_event_rsvps',
    files: ['src/api/eventRsvp.ts'],
    why: 'Reads public RSVP counts; sends event ids only.',
  },
  {
    call: 'spolky_events',
    files: [
      'src/api/mapEvents.ts',
      'src/services/spolky/spolkyService.ts',
      'src/api/societyPosts.ts',
    ],
    why: 'Public society feed reads; writes are by a signed-in society, not a student.',
  },
  {
    call: 'societies',
    files: ['src/api/societies.ts', 'src/api/societiesAdmin.ts'],
    why: 'Public society catalog read (names, colours, logo paths); writes are by a signed-in reis_admin, not a student.',
  },
  {
    call: 'usage_stats',
    files: ['src/api/usageStats.ts'],
    why: 'Admin console read, signed-in reis_admin.',
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

export const PLATFORM_PERMISSIONS = {
  /** Info.plist NS*UsageDescription keys. */
  ios: ['NSCameraUsageDescription'],
  /** AndroidManifest uses-permission names, without the android.permission. prefix. */
  android: ['INTERNET', 'POST_NOTIFICATIONS', 'ACCESS_WIFI_STATE', 'CHANGE_WIFI_STATE'],
};
