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
- **Events appear on the map:**
  - pins for the next 14 days
  - the Akce list, covering the semester. Dnes and Zítra are labelled, followed by Tento týden and Příští týden, with Později folded. This is unchanged.
  - the phone's peek band
- **No follow, no RSVP, no count, no timetable block, no reminders, no digest.**
- **Novinky lists events from the next 7 days** that pass the audience rule, with no follow filter. The unread badge stays. Taps cluster in the week before an event (see the data below). Impersonation applies to Novinky as well.
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
- **The cold-start gap on native.** `loadContext` runs once at boot (`useAppStore.ts:174`). On Capacitor, `getUserParams` can lose the race with session restore (`loadFollows.ts:87`). That would leave `userFaculty` null for the whole session, and the student would see public events only.
  - Follows were persisted, which hid this gap. The rule needs the same protection.
  - Persist the last known `{ facultyKey, erasmus }` in IndexedDB `meta`.
  - Re-run `loadContext` once IS data arrives after a restore.

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
  - delete the IndexedDB `meta` keys `event_rsvps_mine`, `reis_subscribed_associations`, `reis_associations_chosen`, `reis_erasmus_auto_subscribed`, `reis_muted_associations`, `reis_notify_prefs`, `reis_notify_asked` and `viewed_notifications_analytics`. Novinky's dedupe moves to `event_seen_ids`.
  - Capacitor only: `LocalNotifications.cancel` on every pending notification, and `deleteChannel` for `reis-event-reminders` and `reis-society-digest`, so Android settings no longer list them.
  - Keep `seen_deadline_alerts`, because deadline badges depend on it.
- `@capacitor/local-notifications` and Android `POST_NOTIFICATIONS` stay for this one release, because the cleanup needs them. Remove them in the next release, together with the permission entry in the disclosures.

### 4. Novinky: 7 days, filtered by audience (shared, both trees)
- `services/spolky/spolkyService.ts`:
  - The fetch window is `date <= today + 6`. Old builds keep 14 days.
  - `filterNotificationsByFaculty(subscribed)` is replaced by the audience rule from section 1. It uses the same `viewer`, so impersonation applies here too.
  - Remove `trackNotificationsViewed` and `trackNotificationClick` (`increment_post_view` / `increment_post_click`). A Novinky row on screen fires **Seen**, and the tap opens the card, which fires **Opened**. All three admin numbers then count both surfaces the same way.
- `hooks/useNotificationFeed.ts`: drop the `useSpolkySettings` dependency.
- `hooks/useOpenNotification.ts`: drop the click counter.
- `dropScheduledEvents.ts` (`visible_from`), `notifications_cache` and `read_notifications` stay.
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
  - **Opened fires when the card opens** (on the selection), not from the pin and row click handlers. Otherwise opens from the peek band and from deep links go uncounted.
  - On the phone, Seen fires only while the Map tab is actually visible.
  - The three numbers need one unit. Today Seen is once per device and Opened is once per session, so Opened could exceed Seen. Events already live would also show Seen 0 next to their historical opens. See the open questions.
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
  - `map_event_views` gains `increment_event_signal` for "link" (a student action).
  - "Seen" gets **its own flow**, `when: 'background'`, with policy wording along the lines of "when an event appears on your screen". It sits behind Firefox consent.
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

There are two independent PRs against `test`, neither stacked on the other. Follow, RSVP, reminders and Novinky import each other's state (`createRsvpSlice` reads `notifyPrefs`; `replanNotifications` waits on `rsvpLoaded`; `useNotificationFeed` filters on follows), so splitting the removal does not typecheck.

- **1. Reduction:** sections 1–4, 6 and 7, plus the device cleanup.
- **2. Counters:** section 5, with the migration. The migration is applied before the release.

Both stay open until approved, then ride one release together.

**Release timing.** `test` currently carries #475 (the digest and the Sledovat
chip). A release cut from `test` before PR 1 lands would ship those to students.
Either cut no release until then, or revert #475 first. PR 1 removes that work,
so its pending device test is no longer needed.

UI verification follows the `verify-ui` skill: 320/390/430 and tablet width, both themes; desktop map and Profile; before/after PNGs sent.

## What the data says (production, 2026-10-08)

The two counters run on separate paths. A Novinky tap opens the card without bumping the map counter, so the paths do not overlap. The comparison is skewed in two directions:

- **Map opens are undercounted.** They are counted once per session per event, and only by 5.3.0 and later (from 25 Sep).
- **Novinky taps are overcounted.** They come from every build since 5.1.1, and every tap counts, repeats included.

So the map figure is a floor and the Novinky figure is a ceiling.

Events dated from 29 Sep on, while both counters were live:

| | Novinky taps | Map opens |
| --- | --- | --- |
| Public, own-faculty events (Kvíz 7.10, Bruch 7.10, Filmový klub, Tour de Pub, Gamenight) | 139 | 202 |
| ESN, Erasmus only | 25 | 80 |
| **Total** | **≈165** | **≈280** |

- **About 37% of event taps come through Novinky.** Its pull is strongest on the day an event first appears: the SU PEF import got 30 + 20 Novinky taps against 20 + 20 map opens the same day.
- **Taps cluster within about a week of the event.** Events further out get Novinky "seen" impressions and zero taps.
- Map visitors are 130–230 devices a day, against about 1,600 daily actives.
- Attendance is not measurable.

## Open questions

1. ~~Novinky~~: decided 2026-10-08. Keep it, limited to 7 days and filtered by audience.
2. The counter unit: once per device for all three numbers, or once per session for all three?
3. Remove the reis_admin "top events" block in FeatureSignals, now that every event carries its own numbers?
