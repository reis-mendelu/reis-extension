# Society events: reduction

Status: proposal, 2026-10-08. Nothing below is built yet.

## Why

The model has changed. Societies no longer post their own events; reIS imports
them (production: 57 events, every one written by reis_admin or an import; 7
society logins, all unused). The code still carries the self-service model:
follow, RSVP with counts, reminders, a digest, and Novinky as a society feed.
The goal is reduction. A student should see that an event exists, quietly, and
nothing more.

Production numbers, 2026-10-08:
- `spolky_events` by society: ESN 37 (35 restricted), SU PEF 12, AU FRRMS 7 (3 restricted), USAF 1.
- `event_rsvps`: 32 rows in all (11 going, 21 interested).
- `spolky_events` has 0 rows whose association is `admin` or `academic_*`. Novinky's
  feed is society events and nothing else.

## Agreed behaviour

**Student, on both trees:**
- **Events appear on the map only:**
  - pins for the next 14 days
  - the Akce list, covering the semester. Dnes and Zítra are labelled, followed by Tento týden and Příští týden, with Později folded. This is unchanged.
  - the phone's peek band
- **No follow, no RSVP, no count, no timetable block, no reminders, no digest.**
- **Novinky carries no society events.**
- **The card shows:** logo, title, "Pořádá X", description, date and time, category, place, and the Instagram or more-info link.
- **Profile has no Spolky section.**

**Audience rule, automatic and strict:**

| Society | `subscribers_only = true` means |
| --- | --- |
| a faculty society (`facultyKey` is not `mendelu`), EY included | students of that faculty |
| ESN (`audienceLabel = 'erasmus'`) | Erasmus students |
| reIS (`mendelu`, no label) | everyone, because it cannot be restricted |

- A student sees every audience they belong to, so an Erasmus student at PEF sees both ESN and SU PEF.
- If the faculty is unknown, the student sees public events only.
- While impersonating, the impersonated student's `selection.faculty` is used in place of the admin's own. Erasmus status is false, because the picker cannot impersonate an Erasmus student.

**Admin:**
- Each event shows three numbers:
  - **Seen**: the row or pin was on screen, counted once per device
  - **Opened**: the detail card was opened
  - **Link tapped**
- Society logins stay; they are unused but still work.
- The way into the admin console is a long-press on the Profile header. Once signed in, a "Správa" row is visible.

## Constraints from released builds

Builds 5.1.1–5.3.0 keep RSVP, the follow checkboxes and Novinky until students
update. So:

- **Keep server-side:**
  - `event_rsvps`, `set_event_rsvp`, `get_event_rsvps`
  - `increment_post_view` / `increment_post_click`
  - `spolky_events.view_count` / `click_count`
  - `societies.auto_follow_faculty`
  
  Drop them in a later release, once those builds are gone.
- **Reuse `subscribers_only`** and give it the new meaning. Old builds auto-follow the faculty society, and ESN for Erasmus students, so they already show restricted events to roughly the right people. A new column would make old builds show everything.
- **"Seen" gets its own counter.** `view_count` keeps growing from old builds' Novinky and would mix two meanings.
- **5.3.0 scheduled 2-hour RSVP reminders.** Phones may still hold pending ones, so the new build cancels them once.

## Changes by area

### 1. Audience rule (shared, both trees)
- `src/utils/eventAudience.ts`:
  - Replace `visibleToStudent(events, subscribed)` with `visibleToStudent(events, viewer)`, where `viewer = { facultyKey: FacultyKey | null, erasmus: boolean }`, plus a pure `audienceOf(society)` returning `'everyone' | 'erasmus' | FacultyKey`.
  - `audienceLabelKey` drops the `autoFollowFaculty` condition, so EY reads "Jen studenti PEF".
  - The `admin.audience.followers` wording goes.
- `src/hooks/useVisibleMapEvents.ts`: build `viewer` from the store (`userFaculty`, `isErasmus`, `impersonation?.selection.faculty`) and the societies catalog. Map the label through `FACULTY_LABEL_TO_KEY`.
- **Tests first:** a table test for the rule. It covers every society, Erasmus with a faculty, an unknown faculty, impersonation, and reIS with `subscribers_only = true`.

### 2. Follow removed (shared, both trees)
- **Delete:**
  - `store/slices/createFollowSlice.ts`
  - `store/slices/follows/*`
  - `hooks/useSpolkySettings.ts`
  - `CampusMap/FollowChip.tsx`
  - `Sidebar/Profile/SpolkySection.tsx`
  - `Sidebar/Profile/NotifySettings.tsx` (MuteBell)
  - `mobile/NotifySoftAsk.tsx`
  - `services/spolky/renamedAssociations.ts`, once nothing reads follows
- **Edit:**
  - `EventDetailCard.tsx`: remove the chip
  - `MapEventsSection.tsx` and `NotificationsSheet.tsx`: remove the soft-ask
  - `ProfilePopup.tsx` and `ProfileScreen.tsx`: remove the section
  - `useAppStore.ts`: remove `loadFollows` and `retryFollowsIfUnresolved` from boot
  - `capacitor/startApp.ts`: remove the follows retry and the notification-permission read
  - `createI18nSlice.ts` and `createMapSlice.ts`: remove the `replanNotifications` calls
  - `store/types.ts`
- `SocietyForm.tsx` and `societyFormRules.ts`: remove the auto-follow checkbox and the `autoFollowHolder` rule. The column stays because old builds read it.

### 3. RSVP, reminders and calendar blocks removed (shared, both trees)
- **Delete:**
  - `api/eventRsvp.ts`
  - `store/slices/createRsvpSlice.ts`, `rsvpBlockSync.ts`
  - `utils/rsvpBlocks.ts`
  - `CampusMap/EventRsvp.tsx`
  - `WeeklyCalendar/RsvpBlockPopover.tsx`
  - `services/eventReminders/*`
  - `mobile/reminderTap.ts`, `mobile/devNotifyOverride.ts`
- **Edit:**
  - `EventDetailCard.tsx`
  - `WeeklyCalendar/index.tsx` and `WeeklyCalendar/utils.ts`: the RSVP-block routing
  - `utils/lessonPlace.ts` and `utils/customEventLesson.ts`: the event-host branch
  - `mobile/screens/calendar/useOpenLesson.ts` and `useShowLessonOnMap.ts`: the event branch; lessons keep show-on-map
  - `AgendaEvent.tsx` and `NowNextCard.tsx`: the host-in-teacher-slot branch
  - `capacitor/startApp.ts`: remove `installReminderTapHandler`
  - `createMapSlice.reloadMapEvents`: remove `loadRsvps`
- **One-time device cleanup**, new `src/services/cleanup/retireSocietyFeatures.ts`, run once at boot, idempotent, logged via `logError`:
  - delete custom events whose id starts with `rsvp:`. Without this they become orphan blocks that nothing can remove, because the card toggle is gone.
  - delete the IndexedDB `meta` keys `event_rsvps_mine`, `reis_subscribed_associations`, `reis_associations_chosen`, `reis_erasmus_auto_subscribed`, `reis_muted_associations`, `reis_notify_prefs`, `reis_notify_asked`, `notifications_cache` and `viewed_notifications_analytics`.
  - Capacitor only: `LocalNotifications.cancel` on every pending notification.
- `@capacitor/local-notifications` and Android `POST_NOTIFICATIONS` stay for this one release, because the cleanup needs them. Remove them in the next release, together with the permission entry in the disclosures.

### 4. Novinky without society events (shared, both trees)
- **Remove:**
  - from `services/spolky/spolkyService.ts`: the `spolky_events` read and the society counters (`fetchNotifications`, `filterNotificationsByFaculty`, `trackNotificationsViewed`, `trackNotificationClick`)
  - `services/spolky/dropScheduledEvents.ts`
  - from `hooks/useNotificationFeed.ts` and `hooks/useOpenNotification.ts`: the society branch
  - from `NotificationItem.tsx`: the society rendering
- **Reduce** `createNotificationSlice.ts` to what deadline alerts need (`seenDeadlineAlertIds`). The bell badge counts deadline alerts only.
- **Delete dead code found on the way:**
  - `services/spolky/config.ts`
  - `hooks/useEventsFacultySettings.ts`
  - the unmounted `EventsFeed` → `useEventsFeed` → `EventsDropdown` chain, if confirmed unreachable at implementation time

### 5. Counters and the three numbers (server and admin)
- **New migration `20261009120000_event_signals.sql`:**
  - `event_map_views` gains `seen int not null default 0` and `link_taps int not null default 0`. It stays per event and per day, with no identifier; `views` keeps meaning Opened.
  - `increment_event_signal(row_id uuid, signal text)`: a SECURITY DEFINER function granted to anon. `signal` is `'seen'` or `'link'`. The server stamps the date. `increment_event_map_view` stays for old builds.
  - `event_signals(p_event_ids uuid[])` returns `(event_id, seen, opened, link_taps)` totals. It is allowed for reis_admin, or for an association reading its own events. Add it to `READ_ONLY_SUPABASE_RPCS`.
  - Dry-run in a self-unwinding `DO` block. Apply by hand before the client ships.
- **Client:**
  - `api/featureUsage.ts` gains `trackEventSignal(id, 'seen' | 'link')`, gated on consent and demo mode like `trackMapEventView`.
  - "Seen" is deduplicated per device in IndexedDB (`event_seen_ids`). Opened stays once per session.
  - `EventRow` / `MapEventsSection` and `MapSheetPeek` fire Seen when the element is at least 50% visible (IntersectionObserver, as `NotificationItem` does today).
  - `EventLayer` fires Seen for pins inside the map bounds while the map is visible in campus overview.
  - `eventLinks` / `EventDetailCard` fire Link on a tap of the link button.
- **Admin:**
  - `AdminConsole/EventStats.tsx` shows Seen · Opened · Link tapped, updates `EventStatsNote`, and drops views, clicks and interest.
  - `store/slices/admin/loadSocietyPosts.ts` replaces `fetchEventRsvps` with `fetchEventSignals`.
  - `createAdminSlice` replaces `societyRsvpCounts` with `societyEventSignals`.

### 6. Hidden admin entry (both trees)
- **New `hooks/ui/useLongPress.ts`** (none exists): pointer events, about 700 ms, cancelled on move. It is applied to the identity block (`ProfileIdentity` on the phone and iPad, the name row in `ProfilePopup` on desktop) and calls `openSocietyAdmin()`.
  - Needs `select-none` and `[-webkit-touch-callout:none]`, so iOS does not open the text-selection callout.
- **A "Správa" row is shown when `adminSession` is set**, next to the existing reis_admin impersonation row. The session already restores at boot (`loadAdminSession`).

### 7. Composer (admin)
- `ComposerAudienceField` labels become "Pro všechny" / "Jen studenti {FAC}" / "Jen Erasmus".
- The toggle is hidden when `audienceOf(society) === 'everyone'` (reIS).
- The hint text drops the follow wording.
- Nothing else in the composer changes.

### 8. Privacy, guards, docs
- `privacy/disclosures.ts`:
  - `survey_and_rsvp` becomes `survey`, without `eventRsvp.ts` or `set_event_rsvp`.
  - Drop the `society_post_counters` flow.
  - `map_event_views` gains `increment_event_signal` and policy rows for "seen" and "link".
  - Exempt: drop `get_event_rsvps`; add `event_signals`; reword the `spolky_events` reason ("writes are by reIS staff or a society login").
- Run `npm run privacy:generate` so `docs/privacy-policy-app.md` is regenerated. Hand-edit `PRIVACY.md`. Update CLAUDE.md, "What reIS still sends", item 5. The gist is published at release.
- `noStudentDataLeaves.test.ts`: remove `eventRsvp.ts` from `SUPABASE_CALLERS` and update the RSVP note on Firefox consent.
- `scripts/appHealth.ts`: remove the RSVP and post-counter RPCs.
- **Delete guards:**
  - `rsvpBlocksWithdrawOnBothTrees.test.ts`
  - `notificationUiIsPhoneOnly.test.ts`
  - `reminderTapIsPhoneOnly.test.ts`
- **Edit** `desktopHasNoShowOnMap.test.ts`: remove the RSVP half.
- **New guard `societyEventsStayReduced.test.ts`**: fails if `set_event_rsvp`, a follow store, or `LocalNotifications.schedule` reappears under `src/`, and records the reason.
- The import skill (untracked, main checkout): "followers only" becomes "their faculty / Erasmus".
- i18n: remove the follow, RSVP and notify keys; add the stats labels.

## Shipping

There are three PRs against `test`. All of them stay open until all three are
approved, and then they ride one release together:

- **A: audience rule, follow removed, Profile section removed, hidden entry.** These go together because follow drives visibility today and SpolkySection holds the admin button.
- **B: RSVP, reminders and calendar blocks removed, plus the device cleanup.**
- **C: Novinky society feed removed, plus the migration, the counters and the three admin numbers.** The migration is applied before the release.

The work on `test` from #475 (digest, Sledovat chip) is removed by A and B, so
its pending device test is no longer needed.

UI verification follows the `verify-ui` skill: 320/390/430 and tablet width, both themes; desktop map and Profile; before/after PNGs sent.
