# Society Event Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students who follow a society hear about its events. They get one 18:00 digest about tomorrow and about what's new, keep the existing 2-hour reminder for events they RSVP'd to, and can turn it all off in Profile. Everything is local notifications.

**Architecture:**
- Follows move out of `useSpolkySettings` React state into a Zustand `createFollowSlice`, which also holds mutes, three switches, and the soft-ask flag.
- One pure `planNotifications` replaces `planReminders` and produces RSVP pings plus digests.
- `syncReminders` reconciles the merged plan. It never asks for permission itself: only user actions ask.
- UI: a soft-ask card and the Profile switches (phone/iPad tree), plus a follow chip on the shared event card.

**Tech Stack:** React 19 + TypeScript, Zustand slices, IndexedDBService, `@capacitor/local-notifications` 8.3, Vitest + Testing Library, DaisyUI/Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-28-society-event-reminders-design.md`

## Global Constraints

- **Branch:** start from `origin/test` after PR #474 has merged. This plan builds on #474's `refreshMapEventsIfStale`, `MapEventsSection`, `EventDetailCard`, `eventWindow` and `isFinishedEvent`. The PR targets `test` (`gh pr create --base test`).
- **Nothing leaves the device.** Follows, mutes, switches and plans live in IndexedDB `meta`. No Supabase or other calls are added. `privacy/disclosures.ts` is unchanged.
- **IndexedDB keys:**
  - existing, unchanged: `reis_subscribed_associations`, `reis_associations_chosen`, `reis_erasmus_auto_subscribed`
  - new: `reis_muted_associations`, `reis_notify_prefs`, `reis_notify_asked`
- **Digest time:** 18:00 local; next 14 days; skip a day whose 18:00 is past; skip an empty digest. The new-events window runs from (D−1) 18:00, exclusive, to D 18:00, inclusive, local time, by `createdAt`.
- **RSVP pings:** unchanged rule (`REMINDER_LEAD_MS` before a readable start time), and ids stay `reminderId(eventId)`.
- **Digest ids:** FNV-1a of `"digest:" + YYYY-MM-DD`, with `reminderId`'s masking.
- **Cap:** 50 notifications total, soonest first.
- **Permission:**
  - `syncReminders` never calls `requestPermission`.
  - Permission is requested only by explicit user actions: the soft-ask **Zapnout**, turning on a Profile switch, and a new RSVP answer.
  - The RSVP case keeps today's behaviour, where the first RSVP asks.
  - Plugin 8.3 would otherwise prompt from inside `schedule()`, so sync schedules only when `checkPermission()` returns `granted`.
- **Android channels:**
  - `reis-event-reminders`: "Připomínky akcí" / "Event reminders"
  - `reis-society-digest`: "Akce spolků" / "Society events"
  - created before the first schedule
  - `isExactNotification: false`, `allowWhileIdle: true`
- **UI rules:**
  - DaisyUI semantic classes only; no custom CSS.
  - All state in slices; no `useEffect` fetching; no localStorage.
  - New files ≤200 lines.
  - New strings go in both `cs.json` and `en.json`. App language codes are `'cz'`/`'en'`; locales are `cs-CZ`/`en-US`.
- **Tree parity:**
  - The follow chip and the follow list are on both trees.
  - The soft-ask card, the Oznámení group and the mute bells are phone/iPad only, pinned by `src/test/guards/notificationUiIsPhoneOnly.test.ts`.
- **Local checks:** `npx vitest run <touched tests> --no-file-parallelism --maxWorkers=1`, `npm run typecheck` and `npm run nuia:gate`. Run prettier on changed files. The full suite and lint are left to CI.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git stash`. Push via the `personal` remote.

---

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `src/store/slices/createFollowSlice.ts` | create | follows, mutes, prefs, asked flag, permission state; actions |
| `src/store/slices/follows/loadFollows.ts` | create | the load/auto-follow logic moved out of `useSpolkySettings` |
| `src/store/types.ts`, `src/store/useAppStore.ts` | modify | compose the slice; `initializeStore` calls `loadFollows` |
| `src/hooks/useSpolkySettings.ts` | rewrite | thin reader over the slice, with the same return shape |
| `src/hooks/useAppLogic.ts` | modify | drop the bare `useSpolkySettings()` load trigger |
| `src/types/events.ts`, `src/api/mapEvents.ts` | modify | `MapEvent.createdAt` |
| `src/services/eventReminders/plan.ts` | modify | `planNotifications`, `digestId`; `planReminders` removed |
| `src/services/eventReminders/digestText.ts` | create | digest title/body from events and labels |
| `src/services/eventReminders/sync.ts` | modify | channels, `channelId`/`extra`, no request inside reconcile; `askNotificationPermission`, `readNotificationPermission` |
| `src/store/slices/follows/replanNotifications.ts` | create | reads the store, plans, syncs |
| `src/store/slices/createRsvpSlice.ts` | modify | calls `replanNotifications` and asks on a new answer; old `refreshReminders` removed |
| `src/mobile/reminderTap.ts` | modify | a digest tap opens the Akce list |
| `src/components/mobile/NotifySoftAsk.tsx` | create | the soft-ask card |
| `src/mobile/devNotifyOverride.ts` | create | DEV-only `?notify=` override |
| `src/components/CampusMap/MapEventsSection.tsx`, `src/components/mobile/sheets/NotificationsSheet.tsx` | modify | mount the card (phone only) |
| `src/components/Sidebar/Profile/SpolkySection.tsx`, `src/components/Sidebar/Profile/NotifySettings.tsx` (create), `src/components/mobile/screens/ProfileScreen.tsx` | modify/create | Oznámení group plus bells |
| `src/components/CampusMap/FollowChip.tsx` (create), `EventDetailCard.tsx` | create/modify | the follow chip |
| `src/test/guards/notificationUiIsPhoneOnly.test.ts` | create | parity guard |
| `capacitor/startApp.ts` | modify | refresh the permission state on resume |
| locales | modify | strings per task |

---

### Task 1: `createFollowSlice`, with follows moved out of `useSpolkySettings`

**Files:**
- Create: `src/store/slices/createFollowSlice.ts`, `src/store/slices/follows/loadFollows.ts`
- Modify: `src/store/types.ts` (the `AppState` union), `src/store/useAppStore.ts` (compose; call `loadFollows()` in `initializeStore` Tier 2, next to `loadMapEvents`), `src/hooks/useSpolkySettings.ts`, `src/hooks/useAppLogic.ts:63`
- Test: `src/store/slices/__tests__/createFollowSlice.test.ts` (new); keep every existing `useSpolkySettings`/`NotificationFeed`/`useVisibleMapEvents` test passing

**Interfaces:**
- Produces:

```ts
export type NotifyPrefs = { myEvents: boolean; followedEvents: boolean; newEvents: boolean };
export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported' | null; // null = not read yet
export interface FollowSlice {
  followed: string[];
  followsLoaded: boolean;
  muted: string[];
  notifyPrefs: NotifyPrefs;
  permissionAsked: boolean;
  notifyPermission: NotifyPermission;
  loadFollows: () => Promise<void>;
  toggleFollow: (id: string) => Promise<void>;
  toggleMute: (id: string) => Promise<void>;
  setNotifyPref: (key: keyof NotifyPrefs, value: boolean) => Promise<void>;
  markPermissionAsked: () => Promise<void>;
  setNotifyPermission: (p: NotifyPermission) => void;
  /** Recomputes and syncs every pending notification. Set in Task 5; a no-op until then. */
  replanNotifications: () => void;
}
```

- [ ] **Step 1: Write the failing tests** in `createFollowSlice.test.ts`.
  - Mock `IndexedDBService` (`src/services/storage`) with an in-memory map, as the other slice tests do. Mock `getUserParams` from `src/utils/userParams`.
  - Cover:
    - `loadFollows` with a saved `['supef']` → `followed` equals `['supef']` and `followsLoaded` is true.
    - With nothing saved, facultyLabel `'PEF'` and not Erasmus → `followed` equals the catalog's auto-follow society for pef (`autoFollowSocietyFor`), and it is written to `reis_subscribed_associations`.
    - An Erasmus student → `['esn']`, with `reis_erasmus_auto_subscribed` set.
    - A saved `[]` without `reis_associations_chosen` → re-resolved once, and `reis_associations_chosen` becomes true.
    - A saved `[]` WITH chosen → stays `[]`.
    - Renamed ids migrate (use one mapping from `renamedAssociations.ts`).
    - `toggleFollow('esn')` adds, persists, and writes `reis_associations_chosen` before the list. Assert the write order via the mock's call order.
    - `toggleMute`, `setNotifyPref` and `markPermissionAsked` persist to their keys.
    - `loadFollows` reads the muted, prefs and asked keys, with the defaults `[]`, all true, and false.

- [ ] **Step 2: Run.** `npx vitest run src/store/slices/__tests__/createFollowSlice --no-file-parallelism --maxWorkers=1`. Expect FAIL, because the module is missing.

- [ ] **Step 3: Implement `loadFollows.ts`.**
  - Move the body of `loadSettings` from `useSpolkySettings.ts` (lines ~40–155) into `export async function loadFollowedList(): Promise<string[] | null>`, **verbatim, with its comments**.
  - Replace each `setSubscribedAssociations(x)` with capturing the final list, and each `mountedRef` check with nothing.
  - Keep the Erasmus top-up branch.
  - It returns the final list, or `null` when nothing resolved. The `logError` context becomes `'Follows.load'`.
  - Add `loadNotifySettings(): Promise<{ muted: string[]; prefs: NotifyPrefs; asked: boolean }>`. It reads the three new keys, falls back to defaults, and validates shapes (arrays of strings, booleans).

- [ ] **Step 4: Implement `createFollowSlice.ts`.**

```ts
export const DEFAULT_PREFS: NotifyPrefs = { myEvents: true, followedEvents: true, newEvents: true };
export const createFollowSlice: AppSlice<FollowSlice> = (set, get) => ({
  followed: [], followsLoaded: false, muted: [], notifyPrefs: DEFAULT_PREFS,
  permissionAsked: false, notifyPermission: null,
  loadFollows: async () => {
    const [list, notify] = await Promise.all([loadFollowedList(), loadNotifySettings()]);
    set({ followed: list ?? [], followsLoaded: true, muted: notify.muted, notifyPrefs: notify.prefs, permissionAsked: notify.asked });
    get().replanNotifications();
  },
  toggleFollow: async (id) => {
    const followed = get().followed.includes(id) ? get().followed.filter((x) => x !== id) : [...get().followed, id];
    set({ followed });
    try {
      // CHOSEN first — see the ordering comment moved from useSpolkySettings.
      await IndexedDBService.set('meta', CHOSEN_KEY, true);
      await IndexedDBService.set('meta', STORAGE_KEY, followed);
    } catch (err) { logError('Follows.toggle', err); }
    get().replanNotifications();
  },
  // toggleMute / setNotifyPref / markPermissionAsked: set, persist to their key in try/catch, then replanNotifications()
  setNotifyPermission: (notifyPermission) => set({ notifyPermission }),
  replanNotifications: () => {},
});
```

  - Carry over the full ordering comment from `toggleAssociation`.
  - Export `STORAGE_KEY` and `CHOSEN_KEY` from `loadFollows.ts`.
  - Compose the slice in `useAppStore.ts`, add `FollowSlice` to `AppState` in `types.ts`, and call `void s2.loadFollows()` in `initializeStore`'s Tier-2 microtask (beside `s2.loadMapEvents()`).

- [ ] **Step 5: Rewrite `useSpolkySettings.ts`** as a reader with the same return shape:

```ts
export function useSpolkySettings() {
  const followed = useAppStore((s) => s.followed);
  const loaded = useAppStore((s) => s.followsLoaded);
  const toggleFollow = useAppStore((s) => s.toggleFollow);
  return {
    subscribedAssociations: followed,
    toggleAssociation: toggleFollow,
    isSubscribed: (id: string) => followed.includes(id),
    isLoading: !loaded,
  };
}
```

  - Remove the window-event listener. The store notifies every subscriber now.
  - Delete the bare `useSpolkySettings();` call in `useAppLogic.ts:63` and its import. The store loads follows itself.
  - Update the hook's doc comment.

- [ ] **Step 6: Run the tests.** `npx vitest run src/store/slices/__tests__/createFollowSlice src/hooks src/components/NotificationFeed src/components/mobile/sheets src/hooks/__tests__ --no-file-parallelism --maxWorkers=1`, then `npm run typecheck`.
  - Expect PASS.
  - Tests that mocked `useSpolkySettings` internals, or waited on `reis-spolky-settings-changed`, need to seed `useAppStore.setState({ followed, followsLoaded: true })` instead. Update only the mocking, not the assertions.

- [ ] **Step 7: Commit.** `feat(follows): follows, mutes and notification switches in a store slice`

### Task 2: `MapEvent.createdAt`

**Files:**
- Modify: `src/types/events.ts` (`MapEvent`), `src/api/mapEvents.ts` (`SpolkyEventRow`, `toMapEvent`)
- Test: `src/api/__tests__/mapEvents.test.ts`

- [ ] **Step 1: Failing test.**
  - `toMapEvent({...base, created_at: '2026-09-28T10:00:00+00:00'}, …).createdAt` equals `'2026-09-28T10:00:00+00:00'`.
  - A row with `created_at` missing gives `createdAt === null`.
- [ ] **Step 2: Run** it and see it fail.
- [ ] **Step 3: Implement.**
  - Add `created_at?: string | null` to `SpolkyEventRow`, and `createdAt: row.created_at ?? null` in `toMapEvent`.
  - Add `/** When the society published it (ISO). Null on fixtures and unknown rows. */ createdAt?: string | null;` to `MapEvent`. It is optional so the existing hand-built fixtures still typecheck.
- [ ] **Step 4: Run** and see it pass. **Commit:** `feat(events): carry created_at on map events`.

### Task 3: `planNotifications`, covering RSVP pings and evening digests

**Files:**
- Modify: `src/services/eventReminders/plan.ts`
- Create: `src/services/eventReminders/digestText.ts`
- Test: `src/services/eventReminders/__tests__/planNotifications.test.ts` (new); migrate any existing `planReminders` tests to it

**Interfaces:**
- Consumes: `MapEvent` (with `createdAt`), `RsvpStatus`, `eventStartsAt`, `reminderId`, `REMINDER_LEAD_MS`, and `isFinishedEvent` from `src/components/CampusMap/eventWindow.ts`.
- Produces:

```ts
export const DIGEST_HOUR = 18;
export const DIGEST_DAYS = 14;
export const MAX_PENDING = 50;
export const CHANNEL_RSVP = 'reis-event-reminders';
export const CHANNEL_DIGEST = 'reis-society-digest';
export interface PlannedReminder { id: number; eventId: string; title: string; body: string; at: number; }
export interface PlannedNotification extends PlannedReminder { kind: 'rsvp' | 'digest'; channelId: string; }
export interface PlanInput {
  events: MapEvent[];
  rsvp: Record<string, RsvpStatus>;
  followed: string[];
  muted: string[];
  prefs: { myEvents: boolean; followedEvents: boolean; newEvents: boolean };
  shortName: (societyId: string) => string;
}
export interface DigestLabels { tomorrow: (titles: string) => string; tomorrowMany: (n: number, titles: string) => string; newOnly: (titles: string) => string; plusNew: (n: number, societies: string) => string; leadLabel: string; }
export function digestId(dayIso: string): number;
export function planNotifications(input: PlanInput, now: number, labels: DigestLabels): PlannedNotification[];
```

- [ ] **Step 1: Write the failing tests.**
  - Use `vi.setSystemTime` only where `now` isn't passed. Pass `now` explicitly everywhere, and set `process.env.TZ = 'Europe/Prague'` at the top of the file, as the project's other DST tests do. Grep `TZ` in `src/**/__tests__` and follow that pattern.
  - Build events with a helper `ev(id, society, date, { time, createdAt, endDate, subscribersOnly })`.
  - Cases:
    1. **RSVP ping:** an RSVP'd event tomorrow at 19:00 → one `kind: 'rsvp'` at 17:00 local, with id `reminderId(id)` and `channelId: CHANNEL_RSVP`. With `prefs.myEvents: false` → none.
    2. **Digest:** now = 2026-10-05 12:00; a followed esn event on 2026-10-06 → one digest at 2026-10-05 18:00 local, with id `digestId('2026-10-05')` and a title containing the event title.
    3. **18:00 passed:** now = 2026-10-05 19:00 → no digest for the 5th; the next one is the 6th at 18:00.
    4. **DST:** now = 2026-10-24 12:00; an event on 2026-10-26 → a digest at 2026-10-25 18:00 **local**. Assert `new Date(at).getHours() === 18` and the date 25.
    5. **Muted:** an event from a muted esn → no digest. **Not followed** → no digest.
    6. **New window:**
       - `createdAt` at 2026-10-05 10:00, now = 2026-10-05 09:00 → the digest of the 5th mentions 1 new.
       - `createdAt` at 2026-10-04 17:59 → not new on the 5th (it belongs to the 4th's window). With now after the 4th's 18:00, it's nowhere.
       - Exactly 2026-10-05 18:00 → belongs to the 5th.
    7. **Switches:**
       - `followedEvents: false` → the digest has only the new part, or nothing.
       - `newEvents: false` → only tomorrow's events.
       - Both false → no digests.
    8. **Empty digest:** omitted.
    9. **Cap:** 60 RSVP'd timed events over 14 days → exactly 50, soonest first.
    10. **Stable ids:** two calls with the same input give identical ids.
    11. **Finished or multi-day:** an event on D+1 that is `isFinishedEvent` isn't listed. A multi-day event that started earlier isn't listed as "tomorrow".
    12. **Text:**
        - 1 event → `labels.tomorrow('Pub Quiz (ESN)')`.
        - 3 events → `tomorrowMany(3, 'Pub Quiz, Beerpong')`.
        - New only → `newOnly(...)`, with the body `plusNew(2, 'ESN')`.

- [ ] **Step 2: Run.** `npx vitest run src/services/eventReminders --no-file-parallelism --maxWorkers=1`. Expect FAIL.

- [ ] **Step 3: Implement.** In `plan.ts`, keep `REMINDER_LEAD_MS`, `reminderId` and `eventStartsAt`, and add:

```ts
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((h >>> 1) | 1) >>> 0;
}
export const digestId = (dayIso: string) => fnv(`digest:${dayIso}`);
// reminderId stays exactly as it is (ids already pending on devices).

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Local 18:00 on the calendar day `offset` days after `now`'s day. setDate, not +86400000: DST. */
function digestAt(now: number, offset: number): Date {
  const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); d.setHours(DIGEST_HOUR, 0, 0, 0);
  return d;
}

export function planNotifications(input: PlanInput, now: number, labels: DigestLabels): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const listens = (e: MapEvent) => input.followed.includes(e.societyId) && !input.muted.includes(e.societyId);

  if (input.prefs.myEvents) {
    for (const e of input.events) {
      if (!input.rsvp[e.id]) continue;
      const starts = eventStartsAt(e);
      if (starts === null) continue;
      const at = starts - REMINDER_LEAD_MS;
      if (at <= now) continue;
      out.push({ kind: 'rsvp', channelId: CHANNEL_RSVP, id: reminderId(e.id), eventId: e.id, title: e.title,
        body: [labels.leadLabel, e.location].filter(Boolean).join(' · '), at });
    }
  }

  if (input.prefs.followedEvents || input.prefs.newEvents) {
    const mine = input.events.filter(listens);
    for (let offset = 0; offset < DIGEST_DAYS; offset++) {
      const fire = digestAt(now, offset);
      if (fire.getTime() <= now) continue;
      const tomorrowIso = isoOf(new Date(fire.getFullYear(), fire.getMonth(), fire.getDate() + 1));
      const windowStart = digestAt(now, offset - 1).getTime();
      const tomorrow = input.prefs.followedEvents
        ? mine.filter((e) => e.date === tomorrowIso && !isFinishedEvent(e, fire))
        : [];
      const fresh = input.prefs.newEvents
        ? mine.filter((e) => { const c = e.createdAt ? Date.parse(e.createdAt) : NaN; return c > windowStart && c <= fire.getTime(); })
        : [];
      const text = digestText(tomorrow, fresh, input.shortName, labels);
      if (!text) continue;
      out.push({ kind: 'digest', channelId: CHANNEL_DIGEST, id: digestId(isoOf(fire)), eventId: '', title: text.title, body: text.body, at: fire.getTime() });
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, MAX_PENDING);
}
```

  Delete `planReminders` and its doc. Move the useful parts of its comment (Interested counts too; past warnings are skipped) above the RSVP block.

  `digestText.ts`:

```ts
export function digestText(tomorrow: MapEvent[], fresh: MapEvent[], shortName: (id: string) => string, labels: DigestLabels): { title: string; body: string } | null {
  if (tomorrow.length === 0 && fresh.length === 0) return null;
  const societies = (es: MapEvent[]) => [...new Set(es.map((e) => shortName(e.societyId)))].join(', ');
  const first2 = (es: MapEvent[]) => es.slice(0, 2).map((e) => e.title).join(', ');
  const title = tomorrow.length === 0
    ? labels.newOnly(`${first2(fresh)} (${societies(fresh)})`)
    : tomorrow.length <= 2
      ? labels.tomorrow(`${first2(tomorrow)} (${societies(tomorrow)})`)
      : labels.tomorrowMany(tomorrow.length, first2(tomorrow));
  const body = tomorrow.length > 0 && fresh.length > 0 ? labels.plusNew(fresh.length, societies(fresh)) : '';
  return { title, body };
}
```

- [ ] **Step 4: Run** and see it pass. Typecheck fails at `createRsvpSlice` (Task 5 fixes it), so commit Task 3 together with Task 5, or keep a temporary `planReminders` wrapper until Task 5 deletes it. **Choose the wrapper**, so every commit typechecks:

```ts
/** @deprecated removed in Task 5 */
export const planReminders = (events: MapEvent[], answered: Record<string, RsvpStatus>, now: number, leadLabel = '') =>
  planNotifications({ events, rsvp: answered, followed: [], muted: [], prefs: { myEvents: true, followedEvents: false, newEvents: false }, shortName: () => '' },
    now, { tomorrow: () => '', tomorrowMany: () => '', newOnly: () => '', plusNew: () => '', leadLabel });
```

- [ ] **Step 5: Commit.** `feat(reminders): one planner for RSVP pings and the evening digest`

### Task 4: `syncReminders` gets channels, extras, and no permission request

**Files:**
- Modify: `src/services/eventReminders/sync.ts`
- Test: `src/services/eventReminders/__tests__/sync.test.ts` (existing)

**Interfaces:**
- Consumes: `PlannedNotification`, `CHANNEL_RSVP`, `CHANNEL_DIGEST` (Task 3).
- Produces:
  - `syncReminders(planned: PlannedReminder[] | PlannedNotification[], deps?)`, which never requests permission;
  - `askNotificationPermission(deps?): Promise<ReminderPermission | 'unsupported'>`;
  - `readNotificationPermission(deps?): Promise<ReminderPermission | 'unsupported'>`;
  - `ReminderDeps.createChannels(): Promise<void>`.

- [ ] **Step 1: Failing tests.**
  - With a fake `deps` where `checkPermission` returns `'prompt'` and there is something to schedule → `requestPermission` is **not** called and `schedule` is **not** called. This case must be RED against the current code, which asks.
  - With `'granted'` → `createChannels` is called once before `schedule`, and scheduled notifications carry `channelId` plus `extra: { eventId, kind }`.
  - `askNotificationPermission` calls `requestPermission` when the answer is prompt, and returns `'unsupported'` when `isSupported()` is false.
  - The existing tests for cancelling stale ids, for "cancel runs before the permission check", and for the serialised queue still pass.

- [ ] **Step 2: Run** and see it fail.

- [ ] **Step 3: Implement.**
  - In `reconcile`, replace the permission block with:

    ```ts
    const permission = await deps.checkPermission();
    if (permission !== 'granted') return;
    await deps.createChannels();
    await deps.schedule(toSchedule);
    ```

  - Rewrite the comment above it. Asking now belongs to explicit user actions (`askNotificationPermission`), because plugin 8.3 prompts from inside `schedule()`.
  - In `capacitorReminderDeps`:
    - add `createChannels`. It runs once per process, guarded by a module-level promise. It calls `LocalNotifications.createChannel({ id: CHANNEL_RSVP, name: translate(lang, 'notify.channelRsvp'), importance: 4 })` and `({ id: CHANNEL_DIGEST, name: translate(lang, 'notify.channelDigest'), importance: 3 })`, with `lang` from `useAppStore.getState().language`. On iOS `createChannel` is unavailable, so wrap it in `if (Capacitor.getPlatform() === 'android')`.
    - in `schedule`, add `channelId: (r as PlannedNotification).channelId ?? CHANNEL_RSVP`, and set `extra` to `{ eventId: r.eventId, kind: (r as PlannedNotification).kind ?? 'rsvp' }`.
  - Export:

    ```ts
    export async function readNotificationPermission(deps = capacitorReminderDeps()) {
      if (!deps.isSupported()) return 'unsupported' as const;
      try { return await deps.checkPermission(); } catch (err) { logError('EventReminders.readPermission', err); return 'unsupported' as const; }
    }
    export async function askNotificationPermission(deps = capacitorReminderDeps()) {
      if (!deps.isSupported()) return 'unsupported' as const;
      try {
        const p = await deps.checkPermission();
        return shouldAsk(p) ? await deps.requestPermission() : p;
      } catch (err) { logError('EventReminders.askPermission', err); return 'unsupported' as const; }
    }
    ```

  - i18n: `notify.channelRsvp` = "Připomínky akcí" / "Event reminders"; `notify.channelDigest` = "Akce spolků" / "Society events".

- [ ] **Step 4: Run** the sync tests plus typecheck. **Commit:** `feat(reminders): Android channels; sync never raises the permission prompt`

### Task 5: `replanNotifications`, wired into the store

**Files:**
- Create: `src/store/slices/follows/replanNotifications.ts`
- Modify: `src/store/slices/createFollowSlice.ts` (real `replanNotifications`), `src/store/slices/createRsvpSlice.ts` (remove `refreshReminders`; call `get().replanNotifications()` where it was called; on a NEW answer from `setRsvp`, `void askNotificationPermission().then(p => { get().setNotifyPermission(p); get().replanNotifications(); })`), `src/store/slices/createMapSlice.ts` (after a successful `reloadMapEvents`, `get().replanNotifications()`), `src/services/eventReminders/plan.ts` (delete the `planReminders` wrapper), `capacitor/startApp.ts` (on resume, `void readNotificationPermission().then(p => useAppStore.getState().setNotifyPermission(p))`; the same once at boot)
- Test: `src/store/slices/__tests__/replanNotifications.test.ts` (new); `createRsvpSlice` tests updated

**Interfaces:**
- Consumes: `planNotifications`, `syncReminders`, `translate`, the store.
- Produces: `replanNotifications(get: () => AppState): void`, used as the slice action.

- [ ] **Step 1: Failing tests.**
  - Mock `syncReminders`. With `followed: ['esn']`, one esn event tomorrow and now at 12:00, calling `useAppStore.getState().replanNotifications()` → `syncReminders` receives one `kind: 'digest'` notification.
  - Calling `toggleMute('esn')` → the next call receives none.
  - `setRsvp` on a new event → `askNotificationPermission` is called (mocked) and a replan follows.
  - A successful `reloadMapEvents` → a replan.
  - Replan does **not** run before `followsLoaded` is true (guard). An empty plan on a cold boot would cancel every pending notification.
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement.**

```ts
export function replanNotifications(get: () => AppState): void {
  const s = get();
  // Never reconcile from an unread state: an empty plan cancels every pending reminder.
  if (!s.followsLoaded) return;
  const lang = s.language;
  const tr = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);
  const labels: DigestLabels = {
    tomorrow: (titles) => tr('notify.digestTomorrow', { titles }),
    tomorrowMany: (n, titles) => tr('notify.digestTomorrowMany', { n, titles }),
    newOnly: (titles) => tr('notify.digestNewOnly', { titles }),
    plusNew: (n, societies) => tr('notify.digestPlusNew', { n, societies }),
    leadLabel: tr('map.reminderLead'),
  };
  const shortName = (id: string) => s.societies[id]?.shortName ?? id;
  void syncReminders(planNotifications({ events: s.mapEvents, rsvp: s.rsvp, followed: s.followed, muted: s.muted, prefs: s.notifyPrefs, shortName }, Date.now(), labels));
}
```

  - The existing RSVP-slice guards (`if (ok && stored) refreshReminders()`) become `if (ok && stored) get().replanNotifications()`. Keep the comment about never reconciling from an unread `stored`.
  - i18n:
    - `notify.digestTomorrow` "Zítra: {titles}" / "Tomorrow: {titles}"
    - `notify.digestTomorrowMany` "Zítra {n} akce: {titles} a další" / "Tomorrow, {n} events: {titles} and more"
    - `notify.digestNewOnly` "Nové akce: {titles}" / "New events: {titles}"
    - `notify.digestPlusNew` "+ {n} nové akce od {societies}" / "+ {n} new events from {societies}"
- [ ] **Step 4: Run** the tests plus typecheck; `grep -rn planReminders src` must be empty. **Commit:** `feat(reminders): the store replans on events, RSVPs, follows and switches`

### Task 6: A digest tap opens the Akce list

**Files:**
- Modify: `src/mobile/reminderTap.ts`
- Test: `src/mobile/__tests__/reminderTap.test.ts`

- [ ] **Step 1: Failing test.** Given `extra: { kind: 'digest', eventId: '' }`, the handler calls `setMobileTab('map')` and `setMapSheetState('expanded')` and does not call `focusEventById`. `extra: { eventId: 'x' }` with no `kind` behaves as today.
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement.** In `installReminderTapHandler`, read `extra` once. If `extra?.kind === 'digest'`, call `openDigest()`:

  ```ts
  const s = useAppStore.getState();
  s.setMobileTab('map');
  s.setMapSheetState('expanded');
  ```

  Otherwise call `openRemindedEvent(extra?.eventId)` as today. Update the file's doc comment.
- [ ] **Step 4: Run** and see it pass; the `reminderTapIsPhoneOnly` guard still passes. **Commit:** `feat(reminders): a digest opens the events list`

### Task 7: The soft-ask card (phone/iPad) and the `?notify=` dev override

**Files:**
- Create: `src/components/mobile/NotifySoftAsk.tsx`, `src/mobile/devNotifyOverride.ts`
- Modify: `src/components/CampusMap/MapEventsSection.tsx` (render `{isPhone && <NotifySoftAsk />}` above the sections; use the existing phone-viewport hook the tree uses, `usePhoneViewport`), `src/components/mobile/sheets/NotificationsSheet.tsx` (render `<NotifySoftAsk />` at the top of the scroll area)
- Test: `src/components/mobile/__tests__/NotifySoftAsk.test.tsx`

**Interfaces:**
- Consumes: the slice fields (`followed`, `muted`, `permissionAsked`, `notifyPermission`, `markPermissionAsked`, `setNotifyPermission`, `replanNotifications`), `askNotificationPermission`, `useVisibleMapEvents`, `isSoonEvent`, `useSociety`.

- [ ] **Step 1: Failing tests.**
  - The card renders only when all hold: `notifyPermission` is `'prompt'` or `'prompt-with-rationale'`, `permissionAsked` is false, and there is ≥1 visible event from a followed, unmuted society with `isSoonEvent`.
  - With one society `esn` having 5 such events, it shows the text `ESN má 5 akcí v příštích 14 dnech. Chceš večer předem připomínku?` (cs) and the buttons "Zapnout" and "Teď ne".
  - With two societies it shows `Tvoje spolky mají 7 akcí v příštích 14 dnech. …`.
  - **Zapnout** calls `askNotificationPermission` (mocked to `'granted'`), then `markPermissionAsked`, `setNotifyPermission('granted')` and `replanNotifications`.
  - **Teď ne** calls only `markPermissionAsked`.
  - It renders nothing for `'granted'`, `'denied'`, `'unsupported'`, `null`, or when asked.
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement.**
  - `devNotifyOverride.ts`, following `devForcedTarget` in `src/mobile/eduroamNative.ts`:

    ```ts
    export function devNotifyOverride(): 'prompt' | 'granted' | 'denied' | null {
      if (!import.meta.env.DEV || typeof window === 'undefined') return null;
      const v = new URLSearchParams(window.location.search).get('notify');
      return v === 'prompt' || v === 'granted' || v === 'denied' ? v : null;
    }
    ```

    `readNotificationPermission` returns this override first when it is set.
  - The card is a DaisyUI `alert` or `card bg-base-200 border border-base-content/10` with `btn btn-primary btn-sm` and `btn btn-ghost btn-sm` buttons. Count per society with `useSociety(...)?.shortName`.
  - i18n:
    - `notify.askOne` "{society} má {n} akcí v příštích 14 dnech. Chceš večer předem připomínku?" / "{society} has {n} events in the next 14 days. Want a reminder the evening before?"
    - `notify.askMany` "Tvoje spolky mají {n} akcí v příštích 14 dnech. Chceš večer předem připomínku?" / "Your societies have {n} events in the next 14 days. Want a reminder the evening before?"
    - `notify.enable` "Zapnout" / "Turn on"
    - `notify.notNow` "Teď ne" / "Not now"
  - Czech plural: "akcí" is correct for 5+, "akce" for 2–4, "akci" for 1. Add `notify.askOneFew` and `notify.askOneSingle`, or format the count phrase with the project's existing plural helper if there is one (grep `plural` in `src/i18n`).
- [ ] **Step 4: Run** the tests plus typecheck. **Commit:** `feat(reminders): ask for notifications when a followed society has events coming`

### Task 8: Profile → Spolky — the Oznámení group and mute bells (phone/iPad)

**Files:**
- Create: `src/components/Sidebar/Profile/NotifySettings.tsx`
- Modify: `src/components/Sidebar/Profile/SpolkySection.tsx` (optional prop `notifications?: boolean`; when true, render `<NotifySettings />` above the list and a bell button in each FOLLOWED row), `src/components/mobile/screens/ProfileScreen.tsx` (pass `notifications`)
- Test: `src/components/Sidebar/Profile/__tests__/NotifySettings.test.tsx`, plus a SpolkySection test for the bells

- [ ] **Step 1: Failing tests.**
  - Three `toggle toggle-sm` inputs labelled "Připomínky mých akcí", "Akce sledovaných spolků" and "Nové akce", reflecting `notifyPrefs`. Toggling one calls `setNotifyPref`.
  - Turning a switch ON while `notifyPermission` is `'prompt'` also calls `askNotificationPermission`, once.
  - With `notifyPermission === 'denied'`, the switches are replaced by the text "Oznámení jsou vypnutá v nastavení telefonu."
  - A bell `button` with `aria-pressed` and aria-label "Ztlumit {name}" / "Zrušit ztlumení {name}" renders only on followed rows and calls `toggleMute`.
  - Without the `notifications` prop, neither renders (desktop).
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement** with `lucide-react` `Bell` / `BellOff` and DaisyUI classes.
  - Keep SpolkySection ≤200 lines. Put the bell in a tiny `MuteBell` component inside `NotifySettings.tsx` or its own file.
  - i18n:
    - `notify.section` "Oznámení" / "Notifications"
    - `notify.myEvents` "Připomínky mých akcí" / "Reminders for my events"
    - `notify.followedEvents` "Akce sledovaných spolků" / "Events from followed societies"
    - `notify.newEvents` "Nové akce" / "New events"
    - `notify.denied` "Oznámení jsou vypnutá v nastavení telefonu." / "Notifications are turned off in your phone's settings."
    - `notify.mute` "Ztlumit {name}" / "Mute {name}"
    - `notify.unmute` "Zrušit ztlumení {name}" / "Unmute {name}"
- [ ] **Step 4: Run** the tests plus typecheck. **Commit:** `feat(reminders): notification switches and per-society mute in Profile`

### Task 9: A follow chip on the event card (both trees)

**Files:**
- Create: `src/components/CampusMap/FollowChip.tsx`
- Modify: `src/components/CampusMap/EventDetailCard.tsx` (render `<FollowChip societyId={event.societyId} />` in the identity block, after the "Pořádá" span)
- Test: `src/components/CampusMap/__tests__/FollowChip.test.tsx`

- [ ] **Step 1: Failing test.** With `followed: []` it renders a button "Sledovat"; clicking calls `toggleFollow('esn')`. With `followed: ['esn']` it renders "Sleduješ ✓" with `aria-pressed="true"`. EventDetailCard renders the chip.
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement**: `btn btn-ghost btn-xs` with the store selectors. i18n: `notify.follow` "Sledovat" / "Follow"; `notify.following` "Sleduješ ✓" / "Following ✓".
- [ ] **Step 4: Run** the tests; EventDetailCard.tsx stays under 200 lines. **Commit:** `feat(events): follow a society from its event card`

### Task 10: Parity guard, verification, PR

**Files:**
- Create: `src/test/guards/notificationUiIsPhoneOnly.test.ts`

- [ ] **Step 1: Guard.**
  - Following `desktopHasNoShowOnMap.test.ts`, assert that no desktop-tree file imports `NotifySoftAsk` or passes `notifications` to `SpolkySection`. Scan `src/components/Sidebar`, `src/components/AppMain*` and `src/components/AppOverlays*`, excluding the SpolkySection definition itself.
  - Assert that `ProfileScreen.tsx` passes `notifications`.
  - Name both files in the doc comment with the reason: the extension posts no notifications.
- [ ] **Step 2: Run the tests.** `npx vitest run src/test/guards src/store src/services/eventReminders src/components src/mobile src/hooks --no-file-parallelism --maxWorkers=1`, then `npm run typecheck`, `npm run nuia:gate`, and `npx prettier --check $(git diff --name-only --diff-filter=d origin/test HEAD)`.
- [ ] **Step 3: verify-ui.**
  - Serve with `preview_start reis-webapp`.
  - With `?mobile=1&notify=prompt`, measure the Akce list with the card (`--call 'setMapSheetState:"expanded"'`), the Novinky sheet, and Profile with the Oznámení group. Use widths 320/390/430 and 834/1024/1194, in both themes.
  - With `?notify=denied`, measure the denied line.
  - The desktop card with the follow chip (`?mobile=0`).
  - Send before/after PNGs to Dominik (SendUserFile).
- [ ] **Step 4: Device test (real release build, not live reload).**
  - Build and install the release on the cabled iPad and on an Android phone (see the memory notes `ipad-device`, `android-build-on-this-mac` and `device-tests-use-the-real-release-build`).
  - Follow ESN; answer the card with **Zapnout**.
  - Check with `LocalNotifications.getPending` via Safari/Chrome devtools that a digest is pending for 18:00 and RSVP pings are unchanged.
  - To see one fire, wait until 18:00, or RSVP to a timed event starting within about 2 h. Don't add a time override to ship code.
  - Report what was actually observed firing, and what was only seen as pending.
- [ ] **Step 5: PR.** `gh pr create --base test` (GH_TOKEN scoped to ElijaahInverted; `--head` the branch). The body lists both trees, privacy (unchanged), verification, and what was device-tested. Turn Auto-fix on.
