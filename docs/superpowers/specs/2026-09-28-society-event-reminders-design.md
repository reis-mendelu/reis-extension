# Society events: reminders for the societies a student follows

**Date:** 2026-09-28
**Status:** design approved in chat, awaiting spec review
**Builds on:** `2026-09-28-society-events-catalog-design.md` (spec 1, PR #474).
Spec 1 makes the whole semester visible and refreshes events on app resume.
This spec makes sure students hear about those events.

## Problem

Societies want students at their events. Today reIS reminds a student only
about events they RSVP'd to that have a start time, 2 hours before
(`src/services/eventReminders/`). Most events come from semester lists, have
no time, and nobody has RSVP'd to them, so reIS never mentions them.

Following a society changes what Novinky shows, but nothing notifies a
follower. It can't yet: follows live in React state inside
`useSpolkySettings`, and the reminder planner, which runs in the RSVP slice,
cannot see them.

## Goal

A student who follows a society hears about its events without having to
look. There is one short evening message about tomorrow and about what's new,
plus the existing reminder shortly before anything they said they'd attend.
The student can turn any of it off in one obvious place. Nothing about the
student leaves the device.

## Decisions (made in chat, 2026-09-28)

1. **Local notifications only.** No server push and no device tokens. The
   phone already downloads every public event; it plans and schedules for
   itself.
2. **Evening digest plus RSVP pings.** At most one digest per evening, at
   18:00 local time, covering tomorrow's events and new events from followed
   societies. The existing reminder 2 hours before RSVP'd, timed events stays.
   Rejected alternatives:
   - one notification per event (3–4 separate notifications a week from ESN
     alone)
   - digest only (it drops the one reminder people explicitly asked for)
3. **Permission is asked when there is something to remind about.** A reIS
   card comes before the system dialog. It is never shown at a cold start, and
   it is not tied to a follow tap, because most students are followed
   automatically.
4. **The switches live in Profile → Spolky, next to the follow list**
   (option A). Each followed society gets a mute bell there. The event card
   gets a follow chip.
5. **The extension posts no notifications.** It gets the follow chip and
   the follow list only.

## 1. State: `createFollowSlice`

A new Zustand slice owns everything about what a student hears from
societies. All of it is persisted in IndexedDB (`meta`) and never sent.

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `followed` | `string[]` | as today | Moved from `useSpolkySettings`, unchanged. Same keys: `reis_subscribed_associations` and `reis_associations_chosen`. First-run auto-follow (the faculty's society, or ESN for Erasmus students) and the retry for an empty list nobody chose are kept. |
| `muted` | `string[]` | `[]` | Followed, but no notifications. Events stay in Novinky and on the map. Key: `reis_muted_associations`. |
| `notifyPrefs` | `{ myEvents: boolean; followedEvents: boolean; newEvents: boolean }` | all `true` | The three Profile switches. Key: `reis_notify_prefs`. |
| `permissionAsked` | `boolean` | `false` | Set by either answer on the soft-ask card. Key: `reis_notify_asked`. |

Actions:
- `loadFollows()`, called at boot where `useSpolkySettings` loads today
- `toggleFollow(id)`
- `toggleMute(id)`
- `setNotifyPref(key, value)`
- `markPermissionAsked()`

Every action that changes what should be scheduled calls
`replanNotifications()` (section 2).

`useSpolkySettings` becomes a thin reader over the slice with the same return
shape, so its callers keep working unchanged: Novinky, `useVisibleMapEvents`,
both Profile screens, `useAppLogic` and `eventAudience`. This also removes an
Iron Rule breach, since that state currently lives outside a slice.

## 2. Planner

`src/services/eventReminders/plan.ts` gains
`planNotifications(input, now, labels): PlannedNotification[]`, which
replaces `planReminders`.

```ts
interface PlanInput {
  events: MapEvent[];               // mapEvents: the whole catalog (spec 1)
  rsvp: Record<string, RsvpStatus>;
  followed: string[];
  muted: string[];
  prefs: { myEvents: boolean; followedEvents: boolean; newEvents: boolean };
}
type PlannedNotification = PlannedReminder & { kind: 'rsvp' | 'digest'; channelId: string };
```

- **RSVP pings** (`prefs.myEvents`). Exactly today's rule: an RSVP'd event
  with a readable time gets a notification `REMINDER_LEAD_MS` before it
  starts. The id stays `reminderId(eventId)`, so reminders already pending on
  a device are reconciled and not duplicated.
- **Evening digest.** One candidate per local day D, for each of the next 14
  days. It fires at D 18:00 local time. It is skipped when D 18:00 is already
  past, and when it has nothing to say. It lists:
  - **Tomorrow** (`prefs.followedEvents`): events from followed, unmuted
    societies that are not finished and start on D+1.
  - **New** (`prefs.newEvents`): events from followed, unmuted societies whose
    `createdAt` falls in the window from (D−1) 18:00 (exclusive) to D 18:00
    (inclusive), local time, and that are not finished at D 18:00
    (`isFinishedEvent`: their last day is not before D).
    - An event published on D for that same evening is new on D; one whose
      last day has already passed is announced by no digest.
    - Apart from that filter it is a time window, with no "seen" state.
    - Old events never count as new, so there is no first-run burst.
    - Only the digest of day D can mention an event created in that window.
- **Visibility.** Only events the student would see count, per
  `visibleToStudent` (subscribers-only events for followers only). Since only
  followed societies count at all, that is the same set.
- **Text.** Built from `labels`, in the app language at planning time:
  - Title: `Zítra: Pub Quiz, Beerpong (ESN)`. With more than two events:
    `Zítra 3 akce: Pub Quiz, Beerpong a další`. With events from several
    societies, the short names are joined.
  - Body: `+ 2 nové akce od ESN` when there are new events. With only new
    events, the title becomes `Nové akce: …`.
- **IDs.** Stable FNV-1a hashes of `"digest:" + D`, practically disjoint from
  the RSVP id space (FNV hashes; collisions are possible but unlikely). They
  use the same masking as `reminderId`.
- **Cap.** Sort everything soonest first and keep 50. That is below the iOS
  limit of 64 pending notifications.
- **Tap targets.** An RSVP ping opens its event card, as today
  (`reminderTap.ts`). A digest carries `extra: { kind: 'digest' }` and opens
  the Akce list, meaning the phone map tab with its sheet expanded.

`MapEvent` gains `createdAt: string | null`, mapped in `toMapEvent` from
`created_at`. `fetchMapEvents` already selects `*`, so no DB change is needed.

### Sync

`src/services/eventReminders/sync.ts` keeps its diff-based reconcile over the
single merged plan, so there is no second planner to cancel the first one's
notifications.

- **Permission.** Sync schedules only when permission is already `granted`.
  It never calls `requestPermissions`: plugin 8.3 would otherwise raise the
  system dialog from inside `schedule()`. Only explicit student actions ask:
  - **Zapnout** on the soft-ask card;
  - turning a Profile switch on;
  - a new RSVP answer. This keeps today's behaviour, where the first RSVP
    asks.
- **Android channels.** Created once, before the first schedule:
  - `reis-event-reminders`: "Připomínky akcí" / "Event reminders" (RSVP)
  - `reis-society-digest`: "Akce spolků" / "Society events" (digest)

  A channel's importance belongs to the student once it exists, so the ids
  and names are final.
- **Alarm mode.** Inexact with `allowWhileIdle`, and `isExactNotification`
  is never true, as today.

### When it re-plans

`replanNotifications()` runs on the store side. It reads `mapEvents`, `rsvp`
and the follow slice, then calls `syncReminders(planNotifications(...))`. It
is called:
- after every successful events load (boot, and resume via spec 1's
  `refreshMapEventsIfStale`);
- after an RSVP;
- after a follow, mute or switch change;
- after the soft-ask grant.

It replaces the RSVP slice's current `replan`.

## 3. UI

### Soft-ask card (phone/iPad tree only)

`NotifySoftAsk.tsx` renders at the top of `MapEventsSection` and of the
Novinky sheet, but only when all of these hold:

- the platform is Capacitor;
- the permission check returns `prompt` or `prompt-with-rationale`;
- `permissionAsked` is false;
- a followed, unmuted society has at least one visible event starting in the
  next 14 days.

Copy (cs/en): *"ESN má 5 akcí v příštích 14 dnech. Chceš večer předem
připomínku?"*, with the buttons **Zapnout** and **Teď ne**. With several
societies it reads "Tvoje spolky mají 7 akcí…".

- **Zapnout** calls `requestPermissions()`. On `granted` it runs
  `markPermissionAsked()` and `replanNotifications()`. On a refusal it runs
  `markPermissionAsked()` only.
- **Teď ne** runs `markPermissionAsked()`.

The card never returns after either answer.

### Profile → Spolky

- An **Oznámení** group sits above the follow list, with three DaisyUI
  `toggle toggle-sm` switches: *Připomínky mých akcí*, *Akce sledovaných
  spolků* and *Nové akce*.
- When the OS permission is `denied`, the group instead shows *"Oznámení
  jsou vypnutá v nastavení telefonu"*. Switches that would do nothing are not
  shown.
- While permission is still askable (`prompt` or `prompt-with-rationale`),
  the group shows one **Zapnout oznámení** button instead of the switches.
  Tapping it is the moment of intent: it requests permission, and the three
  switches appear once it is granted.
- Every followed society's row gets a **bell** button (`aria-pressed`) that
  mutes or unmutes it.
- The Oznámení group and the bells render in the phone/iPad tree only.
  `SpolkySection` gets a `notifications` prop that only `ProfileScreen`
  passes.

### Follow chip on the event card (both trees)

- In `EventDetailCard`, next to "Pořádá ESN", a `btn btn-ghost btn-xs` chip
  reads **Sledovat** or **Sleduješ ✓** and calls `toggleFollow`.
- It is shared code, so the extension gets it as well.
- For a subscribers-only event the card is shown only to followers anyway.
  After unfollowing, the card stays open until it is closed.

### Parity

| | Extension (desktop) | Phone / iPad |
| --- | --- | --- |
| Follow chip on the card | yes | yes |
| Follow list in Profile | yes | yes |
| Mute bell, Oznámení group, soft-ask card | no (posts no notifications) | yes |

`src/test/guards/notificationUiIsPhoneOnly.test.ts` names
`NotifySoftAsk.tsx` and the phone-only `SpolkySection` notification props,
states the reason, and asserts that no desktop-tree file imports them.

## 4. Testing, privacy, rollout

### Tests (write each failing test first)

- **`planNotifications`:**
  - 18:00 local on the eve of a DST change (25 Oct 2026, Europe/Prague)
  - no digest for today once 18:00 has passed
  - the new-events window, including its edges
  - muted societies are left out
  - each switch off
  - subscribers-only events count only for followers
  - an empty digest is omitted
  - the cap of 50, soonest first
  - ids are stable across re-plans
  - RSVP ids are unchanged
  - cs and en text
- **`syncReminders`** (fake deps):
  - never schedules or requests permission without `granted`
  - channels are created before the first schedule
  - one merged reconcile
  - existing RSVP ids are replaced, not duplicated
- **Follow slice:**
  - existing IndexedDB keys are read, so follows are preserved
  - auto-follow rules are unchanged
  - the retry for an empty list nobody chose
  - toggles persist
- **UI:**
  - the soft-ask card's conditions, and that it does not come back after an
    answer
  - the switches and the denied state
  - the bells and the follow chip
  - the parity guard
- **`verify-ui`:**
  - phone widths 320, 390 and 430, and tablet widths 834, 1024 and 1194
    (`?mobile=1`), in both themes
  - a DEV-only `?notify=prompt|granted|denied` override, following
    `?eduroam=`, lets the native-only pieces render in the dev webapp. Without
    it a clean run would prove nothing.
- **On a device, with the real release build (not live reload), on iOS and
  Android:**
  - a digest fires near 18:00 with the right text
  - tapping it opens Akce
  - an RSVP ping still arrives
  - "Teď ne" never asks again
  - muting a society removes it from the next digest

### Privacy

- Follows, mutes, switches and planned notifications stay on the device.
- No new data flow; `privacy/disclosures.ts` is unchanged.
- Android already declares `POST_NOTIFICATIONS`. The separate task about
  undisclosed merged permissions (for example `SCHEDULE_EXACT_ALARM`) is
  independent of this spec.

### Rollout

- One PR to `test`, after #474 merges.
- The release's "What's new" line is agreed with Dominik before it ships.
- Builds already installed are unaffected; their RSVP reminders carry over by
  id.

### Out of scope

- server push
- extension notifications
- background refresh
- per-category notification settings
