# Timetable → Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone/iPad student turns on one row in the profile sheet. From then on, reIS keeps a "Rozvrh" calendar in their own Google account up to date (lessons, exams and custom events), including from the background, with no reIS server involved.

**Architecture:**
- **TypeScript does the full sync whenever the app runs:**
  - pure modules: normalize, map, plan;
  - a small REST client over `fetch`;
  - a runner, triggered by a store subscription installed only from `capacitor/startApp.ts`.
- **Native code does lessons-only background syncs:**
  - Android: a `JobService`;
  - iOS: a `BGAppRefreshTask`.
- **Google's own SDKs hold the grant on each OS:** `AuthorizationClient` on Android, GoogleSignIn-iOS on iOS. reIS code only ever asks them for a 1-hour access token.
- **One JSON fixture keeps the three lesson mappings byte-identical:** TypeScript, Java and Swift all assert it.

**Tech stack:**
- TypeScript, Vitest, Zustand (store slice);
- Capacitor 8, Java and JobScheduler (Android), `play-services-auth` 22.0.0;
- Swift, BackgroundTasks and GoogleSignIn-iOS 10.x (iOS);
- Google Calendar API v3.

**Spec:** `docs/superpowers/specs/2026-10-08-google-calendar-sync-design.md`. It is approved, and it says *why* for everything below. Read it first.

## Global Constraints

- **Trees:**
  - Phone/iPad only. Nothing under `src/` that the extension imports may import `src/mobile/googleCalendar/**` or the native plugin. Install only from `capacitor/startApp.ts`.
  - The extension gets nothing; record that in `src/test/guards/desktopHasNoGoogleCalendar.test.ts`.
- **Scopes:** exactly `https://www.googleapis.com/auth/calendar.app.created`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly` and `email`. Nothing else.
- **No client secret, no Web client, no relay server.** Android uses an Android OAuth client (package + SHA-1); iOS uses an iOS OAuth client.
- **Google project:** `reis-479320`, owner `reis.mendelu@gmail.com`. Never mention any personal Google account in code, commits or docs.
- **Calendar:** name `Rozvrh`. Time zone `Europe/Prague`. The marker `reis:rozvrh:v1` goes in the calendar description.
- **Event id:** `kindPrefix + base32hex(sha256(stableKey))`. Prefixes `l` lesson, `e` exam, `c` custom. Alphabet `0123456789abcdefghijklmnopqrstuv`.
- **`extendedProperties.private`:** `reisKind` (`lesson|exam|custom`), `reisHash` (the first 16 hex characters of sha256 over the canonical fields), `reisV` = `"1"`.
- **Past events are written only by the device that *creates* the calendar.** Every other sync touches only events with date ≥ today (Europe/Prague).
- **Deletes require all of the following:**
  - the kind's source was confirmed this run;
  - the desired list for that kind is non-empty, or the kind is `custom`;
  - deletes ≤ ⅓ of that kind's existing future events, unless the same delete set was already held back by the previous run.
- **409 on insert** → `PUT` the same id with `status: "confirmed"`.
- **Android background job:** a plain `JobService`. **Never WorkManager**: it loses the network after 5 s (spec, fact 3).
- **Logging:** errors via `logError('GoogleCalendar.<step>', err)`. Never `console.error` directly.
- **Repo rules:** no `localStorage`; no `useEffect` data fetching; DaisyUI classes only; max ~200 lines per file; direct imports, no barrels; test first.
- **Local checks:** `npx vitest run <pattern>` and `npm run typecheck`. Repo-wide lint, format and full test runs are left to CI (CLAUDE.md).
- **Device tests:** signed **release** builds only (`npm run android:push`; the iPad via the `ipad-device` recipe). Sign in as `reis.mendelu@gmail.com`, which is a test user.
- **Branch:** this worktree's branch; the PR goes to `test`. Never push or merge without Dominik's say-so.

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/mobile/googleCalendar/types.ts` | `ReisKind`, `NormalizedEvent`, `DesiredEvent`, `ExistingEvent`, `GoogleEventBody` |
| `src/mobile/googleCalendar/pragueDate.ts` | today in Prague; the academic data window |
| `src/mobile/googleCalendar/normalize.ts` | lessons, exams and custom events → `NormalizedEvent[]` |
| `src/mobile/googleCalendar/eventIdentity.ts` | `base32hex`, `sha256Hex`, `eventId`, `contentHash` |
| `src/mobile/googleCalendar/toGoogleEvent.ts` | `NormalizedEvent` → `DesiredEvent` (body + id + hash) |
| `src/mobile/googleCalendar/plan.ts` | the pure reconcile planner and its delete safeguards |
| `src/mobile/googleCalendar/calendarApi.ts` | the REST client: find/create/get calendar, list events, insert/put/delete, pacing and backoff |
| `src/mobile/googleCalendar/runSync.ts` | orchestrates one sync: token, calendar, per-kind plan and execute, state |
| `src/mobile/googleCalendar/googleCalendarNative.ts` | `registerPlugin('GoogleCalendar')` and its TS interface |
| `src/mobile/googleCalendar/installGoogleCalendarSync.ts` | store subscription, debounce, triggers |
| `src/mobile/googleCalendar/__fixtures__/lessonEvents.json` | shared lesson-mapping fixture (TS, Java and Swift) |
| `src/mobile/googleCalendar/__fixtures__/lessonPlans.json` | shared planner fixture (TS, Java and Swift) |
| `src/store/slices/createGoogleCalendarSlice.ts` | **state only** (status, lastSyncAt, progress, message), so the extension bundle stays clean |
| `src/components/mobile/sheets/GoogleCalendarSheet.tsx` | the sheet: connect, status, disconnect choices |
| `android/app/src/main/java/cz/reis/app/GoogleCalendarPlugin.java` | the Android plugin methods |
| `android/app/src/main/java/cz/reis/app/gcal/*.java` | Java ports: `LessonMapper`, `LessonPlanner`, `CalendarHttp`, `IsTimetable`, `SecureStoreReader`, `SyncConfig`, `CalendarSyncJobService` |
| `native/capacitor-google-calendar/**` | the iOS plugin, the Swift ports and the BG task |
| `src/test/guards/desktopHasNoGoogleCalendar.test.ts` | tree-parity guard |

---

## Milestone 0: De-risk (blocking)

### Task 1: Is `calendar.app.created` per project or per OAuth client?

**Why:** if it's per client, the iPad (iOS client) can't touch the "Rozvrh" the Pixel (Android client) created, and spec option A collapses. **STOP and go back to Dominik if this fails.**

**Files:** nothing in the repo. A throwaway script in the session scratchpad.

- [ ] **Step 1: Create two throwaway Desktop OAuth clients in `reis-479320`** (Chrome, console signed in as `reis.mendelu@gmail.com`, `authuser=2`): Clients → Create client → **Desktop app**, named `spike-client-A`, then `spike-client-B`. Download both JSONs into the scratchpad. Desktop clients use loopback redirects; their "secret" never ships and is deleted with them.

- [ ] **Step 2: Write the probe script** `$SCRATCH/probe.py`, Python 3 stdlib only:

```python
#!/usr/bin/env python3
# THROWAWAY: proves whether calendar.app.created is scoped per project or per client.
import base64, hashlib, http.server, json, os, secrets, sys, urllib.parse, urllib.request, webbrowser
SCOPE = "https://www.googleapis.com/auth/calendar.app.created"

def token(client_file):
    c = json.load(open(client_file))["installed"]
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    code = {}
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            code["v"] = q.get("code", [None])[0]
            self.send_response(200); self.end_headers(); self.wfile.write(b"ok, close this tab")
        def log_message(self, *a): pass
    srv = http.server.HTTPServer(("127.0.0.1", 0), H)
    redirect = f"http://127.0.0.1:{srv.server_port}"
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": c["client_id"], "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "code_challenge": challenge, "code_challenge_method": "S256",
        "login_hint": "reis.mendelu@gmail.com", "prompt": "consent"})
    print("Open:", url); webbrowser.open(url); srv.handle_request()
    body = urllib.parse.urlencode({"code": code["v"], "client_id": c["client_id"],
        "client_secret": c["client_secret"], "redirect_uri": redirect,
        "grant_type": "authorization_code", "code_verifier": verifier}).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", body))["access_token"]

def call(tok, method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode()[:300]
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

B = "https://www.googleapis.com/calendar/v3"
ta = token(sys.argv[1]); tb = token(sys.argv[2])
s, cal = call(ta, "POST", f"{B}/calendars", {"summary": "reIS probe", "timeZone": "Europe/Prague"})
cid = json.loads(cal)["id"]; enc = urllib.parse.quote(cid)
print("A create calendar", s)
ev = {"id": "reisprobe0001", "summary": "probe", "start": {"dateTime": "2026-10-20T09:00:00", "timeZone": "Europe/Prague"},
      "end": {"dateTime": "2026-10-20T10:00:00", "timeZone": "Europe/Prague"}}
print("A insert event", call(ta, "POST", f"{B}/calendars/{enc}/events", ev)[0])
print("B get calendar", call(tb, "GET", f"{B}/calendars/{enc}")[0])
print("B list events", call(tb, "GET", f"{B}/calendars/{enc}/events")[0])
ev["summary"] = "probe edited by B"
print("B put event", call(tb, "PUT", f"{B}/calendars/{enc}/events/reisprobe0001", ev)[0])
print("A delete calendar", call(ta, "DELETE", f"{B}/calendars/{enc}")[0])
```

- [ ] **Step 3: Run it.** Dominik clicks "Allow" twice, as `reis.mendelu@gmail.com`.

Run: `python3 -I $SCRATCH/probe.py $SCRATCH/client-A.json $SCRATCH/client-B.json`
**Pass:** every B line prints `200`. **Fail:** any B line is `403` or `404` → stop the plan and report to Dominik with the output.

- [ ] **Step 4: Clean up.** Dominik deletes `spike-client-A` and `spike-client-B` (the permission check blocks Claude from deleting credentials), and revokes "reIS" for `reis.mendelu` at myaccount.google.com → Security → Third-party connections. Delete the scratch JSONs.

- [ ] **Step 5: Record the result** in the spec, under "Facts verified", with date and outcome.

```bash
git add docs/superpowers/specs/2026-10-08-google-calendar-sync-design.md
git commit -m "docs(spec): calendar.app.created is scoped per <project|client> — measured"
```

### Task 2: iOS spike on the cabled iPad (throwaway)

**Why:** three things only the device can answer:
- does GoogleSignIn refresh silently inside `BGAppRefreshTask`;
- can `AppDelegate` import a local plugin module, which BG task registration needs;
- does GoogleSignIn work in the Mac "Designed for iPad" build.

**Files:** a throwaway branch `spike/ios-gcal` cut from this branch; nothing merged.

- [ ] **Step 1: Create the iOS OAuth client** (keep it; it's the real one). Console → Clients → Create client → **iOS**, bundle id `cz.reis.app`, name `reIS iOS`. Note the client id and the reversed client id; both are identifiers, not secrets.
- [ ] **Step 2: Add GoogleSignIn-iOS** to a throwaway copy of `native/capacitor-google-calendar` (Task 15's skeleton is fine). Then:
  - `connect()` calls `GIDSignIn.sharedInstance.signIn(withPresenting:hint:additionalScopes:)` with the three scopes;
  - `AppDelegate.didFinishLaunching` calls `BGTaskScheduler.shared.register(forTaskWithIdentifier: "cz.reis.app.calendar-sync", ...)`;
  - the handler does `restorePreviousSignIn` → `refreshTokensIfNeeded` → `GET calendarList` and writes the HTTP status to `UserDefaults` key `spike.bg.result`.
- [ ] **Step 3: Install a release build** on the iPad (`ipad-device` recipe) and connect as `reis.mendelu`.
- [ ] **Step 4: Fire the task from the debugger:** pause in Xcode and run `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"cz.reis.app.calendar-sync"]`, then continue. Read `spike.bg.result` on the next foreground.
  **Pass:** `200`.
- [ ] **Step 5: Run the Mac build from Xcode** ("My Mac (Designed for iPad)") and try `connect()`. Record whether it works.
- [ ] **Step 6: Record all three results in the spec, then delete the spike branch.** If the Mac fails, Task 15 hides the row when `ProcessInfo.isiOSAppOnMac`; there's an existing helper pattern in `src/mobile/eduroamNative.ts`.

```bash
git checkout claude/pensive-antonelli-93fc92
git branch -D spike/ios-gcal
git commit -am "docs(spec): iOS BG token refresh / AppDelegate import / Mac — measured"
```

---

## Milestone 1: TypeScript core (pure, fully unit-tested)

### Task 3: Types, Prague date and normalization

**Files:**
- Create: `src/mobile/googleCalendar/types.ts`, `src/mobile/googleCalendar/pragueDate.ts`, `src/mobile/googleCalendar/normalize.ts`
- Test: `src/mobile/googleCalendar/__tests__/pragueDate.test.ts`, `src/mobile/googleCalendar/__tests__/normalize.test.ts`

**Interfaces (produces):**

```ts
export type ReisKind = 'lesson' | 'exam' | 'custom';
export type AppLanguage = 'cz' | 'en';
export interface NormalizedEvent {
  kind: ReisKind;
  key: string; // stable key → event id
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  title: string;
  location: string;
  description: string;
}
export function pragueToday(now?: Date): string; // 'YYYY-MM-DD' in Europe/Prague
export function academicWindow(now?: Date): { start: Date; end: Date }; // same rule as syncSchedule.ts
export function normalizeLessons(lessons: BlockLesson[], lang: AppLanguage): NormalizedEvent[];
export function normalizeExams(subjects: ExamSubject[], lang: AppLanguage): NormalizedEvent[];
export function normalizeCustom(events: CalendarCustomEvent[]): NormalizedEvent[];
export const LABELS: { cz: { lecture: string; seminar: string; exam: string }; en: { lecture: string; seminar: string; exam: string } };
```

- [ ] **Step 1: Write the failing tests**

`src/mobile/googleCalendar/__tests__/pragueDate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { academicWindow, pragueToday } from '../pragueDate';

describe('pragueToday', () => {
  it('is the Prague calendar date, not UTC', () => {
    // 23:30 UTC on 30 Sep is already 1 Oct in Prague (UTC+2 in summer)
    expect(pragueToday(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });
  it('handles winter time', () => {
    expect(pragueToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('academicWindow', () => {
  it('October: 1 Sep this year to 31 Aug next year', () => {
    const w = academicWindow(new Date(2026, 9, 8));
    expect([w.start.getFullYear(), w.start.getMonth(), w.start.getDate()]).toEqual([2026, 8, 1]);
    expect([w.end.getFullYear(), w.end.getMonth(), w.end.getDate()]).toEqual([2027, 7, 31]);
  });
  it('January: previous 1 Sep to this 31 Aug', () => {
    const w = academicWindow(new Date(2027, 0, 15));
    expect(w.start.getFullYear()).toBe(2026);
    expect(w.end.getFullYear()).toBe(2027);
  });
  it('April: 1 Feb to 31 Aug', () => {
    const w = academicWindow(new Date(2027, 3, 1));
    expect([w.start.getMonth(), w.start.getDate()]).toEqual([1, 1]);
  });
});
```

`src/mobile/googleCalendar/__tests__/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeCustom, normalizeExams, normalizeLessons } from '../normalize';
import type { BlockLesson, CalendarCustomEvent } from '../../../types/calendarTypes';
import type { ExamSubject } from '../../../types/exams';

const lesson = (o: Partial<BlockLesson> = {}): BlockLesson =>
  ({
    id: '123', date: '20261012', startTime: '09:00', endTime: '10:50',
    courseName: 'Ekonomie I', courseNameCs: 'Ekonomie I', courseNameEn: 'Economics I',
    room: 'Q01', roomCs: 'Q01', roomEn: 'Q01', isSeminar: 'false', isConsultation: 'false',
    teachers: [{ fullName: 'doc. Jan Novák', shortName: 'Novák', id: '1' }],
    roomStructured: { name: 'Q01', id: '' }, courseCode: 'EBC-E1', courseId: '9',
    periodId: '', studyId: '', campus: '', isDefaultCampus: 'true', facultyCode: 'PEF',
    ...o,
  }) as BlockLesson;

describe('normalizeLessons', () => {
  it('maps a lecture in Czech', () => {
    expect(normalizeLessons([lesson()], 'cz')).toEqual([
      {
        kind: 'lesson', key: '123|20261012|09:00', date: '2026-10-12', start: '09:00', end: '10:50',
        title: 'Ekonomie I – přednáška', location: 'Q01', description: 'doc. Jan Novák\nreIS',
      },
    ]);
  });
  it('uses the English name and seminar label in English', () => {
    const [n] = normalizeLessons([lesson({ isSeminar: 'true' })], 'en');
    expect(n?.title).toBe('Economics I – seminar');
  });
  it('drops exam and custom rows the calendar merges into lessons', () => {
    expect(normalizeLessons([lesson({ isExam: true }), lesson({ isCustom: true })], 'cz')).toEqual([]);
  });
});

describe('normalizeExams', () => {
  const subject: ExamSubject = {
    version: 1, id: 's1', name: 'Ekonomie I', nameCs: 'Ekonomie I', nameEn: 'Economics I', code: 'EBC-E1',
    sections: [
      { id: 'sec1', name: 'zkouška', nameCs: 'zkouška', nameEn: 'exam', type: 'z', status: 'registered',
        registeredTerm: { id: 't9', date: '20.01.2027', time: '09:00', room: 'Q02', roomCs: 'Q02', roomEn: 'Q02', durationMinutes: 120 },
        terms: [] },
      { id: 'sec2', name: 'zápočet', type: 'z', status: 'open', terms: [] },
    ],
  };
  it('maps registered terms only, with duration', () => {
    expect(normalizeExams([subject], 'cz')).toEqual([
      { kind: 'exam', key: 't9', date: '2027-01-20', start: '09:00', end: '11:00',
        title: 'Zkouška: Ekonomie I', location: 'Q02', description: 'zkouška\nreIS' },
    ]);
  });
  it('falls back to 90 minutes and a section-based key', () => {
    const s = structuredClone(subject);
    s.sections[0]!.registeredTerm = { date: '20.01.2027', time: '09:00' };
    const [n] = normalizeExams([s], 'en');
    expect(n).toMatchObject({ key: 's1|sec1', end: '10:30', title: 'Exam: Economics I', location: '' });
  });
});

describe('normalizeCustom', () => {
  it('maps a custom event', () => {
    const e: CalendarCustomEvent = { id: 'c7', title: 'Knihovna', date: '20261015', startTime: '14:00', endTime: '15:00', room: 'B' };
    expect(normalizeCustom([e])).toEqual([
      { kind: 'custom', key: 'c7', date: '2026-10-15', start: '14:00', end: '15:00', title: 'Knihovna', location: 'B', description: 'reIS' },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/mobile/googleCalendar/__tests__/pragueDate.test.ts src/mobile/googleCalendar/__tests__/normalize.test.ts`
Expected: FAIL, "Cannot find module '../pragueDate'".

- [ ] **Step 3: Implement**

`src/mobile/googleCalendar/types.ts`:

```ts
/** What reIS writes to the student's Google "Rozvrh" calendar. See the spec. */
export type ReisKind = 'lesson' | 'exam' | 'custom';
export type AppLanguage = 'cz' | 'en';

export interface NormalizedEvent {
  kind: ReisKind;
  key: string;
  date: string;
  start: string;
  end: string;
  title: string;
  location: string;
  description: string;
}

export interface GoogleEventBody {
  id: string;
  summary: string;
  location: string;
  description: string;
  start: { dateTime: string; timeZone: 'Europe/Prague' };
  end: { dateTime: string; timeZone: 'Europe/Prague' };
  reminders: { useDefault: boolean; overrides?: [] };
  colorId?: string;
  status?: 'confirmed';
  extendedProperties: { private: { reisKind: ReisKind; reisHash: string; reisV: '1' } };
}

export interface DesiredEvent {
  id: string;
  kind: ReisKind;
  date: string;
  hash: string;
  body: GoogleEventBody;
}

export interface ExistingEvent {
  id: string;
  kind: ReisKind;
  date: string; // YYYY-MM-DD of start
  hash: string;
}
```

`src/mobile/googleCalendar/pragueDate.ts`:

```ts
const PRAGUE_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Prague as YYYY-MM-DD. The past/future line of the sync. */
export function pragueToday(now: Date = new Date()): string {
  return PRAGUE_DAY.format(now);
}

/**
 * The window reIS holds lessons for. MUST stay identical to
 * `src/services/sync/syncSchedule.ts` and `src/injector/dataFetchers.ts`,
 * and to the Java/Swift ports (`IsTimetable`).
 */
export function academicWindow(now: Date = new Date()): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 8) return { start: new Date(y, 8, 1), end: new Date(y + 1, 7, 31) };
  if (m <= 1) return { start: new Date(y - 1, 8, 1), end: new Date(y, 7, 31) };
  return { start: new Date(y, 1, 1), end: new Date(y, 7, 31) };
}
```

`src/mobile/googleCalendar/normalize.ts`:

```ts
import type { BlockLesson, CalendarCustomEvent } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';
import type { AppLanguage, NormalizedEvent } from './types';

/**
 * Fixed strings, NOT i18n JSON: the Java and Swift background jobs must
 * produce byte-identical titles, and they cannot read the locale files.
 */
export const LABELS = {
  cz: { lecture: 'přednáška', seminar: 'cvičení', exam: 'Zkouška' },
  en: { lecture: 'lecture', seminar: 'seminar', exam: 'Exam' },
} as const;

const FOOTER = 'reIS';
const DEFAULT_EXAM_MINUTES = 90; // same fallback as useCalendarData

const isoDate = (yyyymmdd: string) =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const clamped = Math.min(total, 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function normalizeLessons(lessons: BlockLesson[], lang: AppLanguage): NormalizedEvent[] {
  return lessons
    .filter((l) => !l.isExam && !l.isCustom)
    .map((l) => {
      const name = (lang === 'en' ? l.courseNameEn : l.courseNameCs) || l.courseName;
      const room = (lang === 'en' ? l.roomEn : l.roomCs) || l.room || '';
      const type = l.isSeminar === 'true' ? LABELS[lang].seminar : LABELS[lang].lecture;
      const teachers = l.teachers.map((t) => t.fullName).filter(Boolean).join(', ');
      return {
        kind: 'lesson' as const,
        key: `${l.id}|${l.date}|${l.startTime}`,
        date: isoDate(l.date),
        start: l.startTime,
        end: l.endTime,
        title: `${name} – ${type}`,
        location: room,
        description: teachers ? `${teachers}\n${FOOTER}` : FOOTER,
      };
    });
}

export function normalizeExams(subjects: ExamSubject[], lang: AppLanguage): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const s of subjects) {
    const subjectName = (lang === 'en' ? s.nameEn : s.nameCs) || s.name;
    for (const sec of s.sections) {
      const t = sec.registeredTerm;
      if (sec.status !== 'registered' || !t) continue;
      const [dd, mm, yyyy] = t.date.split('.');
      const sectionName = (lang === 'en' ? sec.nameEn : sec.nameCs) || sec.name;
      out.push({
        kind: 'exam',
        key: t.id || `${s.id}|${sec.id}`,
        date: `${yyyy}-${mm}-${dd}`,
        start: t.time,
        end: addMinutes(t.time, t.durationMinutes ?? DEFAULT_EXAM_MINUTES),
        title: `${LABELS[lang].exam}: ${subjectName}`,
        location: (lang === 'en' ? t.roomEn : t.roomCs) || t.room || '',
        description: `${sectionName}\n${FOOTER}`,
      });
    }
  }
  return out;
}

export function normalizeCustom(events: CalendarCustomEvent[]): NormalizedEvent[] {
  return events.map((e) => ({
    kind: 'custom' as const,
    key: e.id,
    date: isoDate(e.date),
    start: e.startTime,
    end: e.endTime,
    title: e.title,
    location: e.room ?? '',
    description: FOOTER,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass.** Same command. Expected: PASS.
- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/mobile/googleCalendar
git commit -m "feat(gcal): normalize lessons, exams and custom events for Google Calendar"
```

### Task 4: Event identity, mapping and the shared lesson fixture

**Files:**
- Create: `src/mobile/googleCalendar/eventIdentity.ts`, `src/mobile/googleCalendar/toGoogleEvent.ts`, `src/mobile/googleCalendar/__fixtures__/lessonEvents.json`
- Test: `src/mobile/googleCalendar/__tests__/eventIdentity.test.ts`, `src/mobile/googleCalendar/__tests__/lessonFixture.test.ts`

**Interfaces:**
- Consumes: `NormalizedEvent`, `normalizeLessons` (Task 3)
- Produces:

```ts
export function base32hex(bytes: Uint8Array): string;
export async function sha256Hex(text: string): Promise<string>;
export async function eventId(kind: ReisKind, key: string): Promise<string>;
export async function contentHash(n: NormalizedEvent): Promise<string>; // 16 hex chars
export async function toDesired(n: NormalizedEvent): Promise<DesiredEvent>;
```

- [ ] **Step 1: Write the failing tests**

`__tests__/eventIdentity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { base32hex, contentHash, eventId } from '../eventIdentity';

describe('base32hex', () => {
  it('matches RFC 4648 base32hex vectors (lowercased, unpadded)', () => {
    const enc = (s: string) => base32hex(new TextEncoder().encode(s));
    expect(enc('f')).toBe('co');
    expect(enc('fo')).toBe('cpng');
    expect(enc('foobar')).toBe('cpnmuoj1e8');
  });
});

describe('eventId', () => {
  it('is Google-valid: [a-v0-9], 5–1024 chars, kind-prefixed', async () => {
    const id = await eventId('lesson', '123|20261012|09:00');
    expect(id).toMatch(/^l[0-9a-v]{52}$/);
  });
  it('is stable and kind-separated', async () => {
    expect(await eventId('exam', 'x')).toBe(await eventId('exam', 'x'));
    expect((await eventId('exam', 'x')).slice(1)).toBe((await eventId('custom', 'x')).slice(1));
    expect(await eventId('exam', 'x')).not.toBe(await eventId('custom', 'x'));
  });
});

describe('contentHash', () => {
  it('changes with any visible field and is 16 hex', async () => {
    const base = { kind: 'lesson' as const, key: 'k', date: '2026-10-12', start: '09:00', end: '10:50', title: 'A', location: 'Q01', description: 'reIS' };
    const h = await contentHash(base);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(await contentHash({ ...base, location: 'Q02' })).not.toBe(h);
  });
});
```

`__tests__/lessonFixture.test.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeLessons } from '../normalize';
import { toDesired } from '../toGoogleEvent';
import type { BlockLesson } from '../../../types/calendarTypes';

/**
 * THE contract with the Java (LessonMapperTest) and Swift (LessonMapperTests)
 * ports. If this file changes, all three must change together, or phone and
 * iPad will keep overwriting each other's events.
 * Regenerate deliberately: UPDATE_GCAL_FIXTURES=1 npx vitest run lessonFixture
 */
const PATH = resolve(__dirname, '../__fixtures__/lessonEvents.json');

interface Case {
  name: string;
  lang: 'cz' | 'en';
  lesson: { id: string; date: string; startTime: string; endTime: string; courseName: string; room: string; isSeminar: string; teachers: string[] };
  expected?: { id: string; hash: string; body: unknown };
}

const INPUTS: Omit<Case, 'expected'>[] = [
  { name: 'cz lecture', lang: 'cz', lesson: { id: '123', date: '20261012', startTime: '09:00', endTime: '10:50', courseName: 'Ekonomie I', room: 'Q01', isSeminar: 'false', teachers: ['doc. Jan Novák'] } },
  { name: 'en seminar, two teachers', lang: 'en', lesson: { id: '124', date: '20261013', startTime: '13:00', endTime: '14:50', courseName: 'Economics I', room: 'Q02', isSeminar: 'true', teachers: ['A B', 'C D'] } },
  { name: 'no teacher, no room, diacritics', lang: 'cz', lesson: { id: '9', date: '20270301', startTime: '07:00', endTime: '08:50', courseName: 'Účetnictví – úvod', room: '', isSeminar: 'false', teachers: [] } },
];

const toBlock = (l: Case['lesson']): BlockLesson =>
  ({ ...l, courseNameCs: l.courseName, courseNameEn: l.courseName, roomCs: l.room, roomEn: l.room,
     teachers: l.teachers.map((fullName, i) => ({ fullName, shortName: fullName, id: String(i) })) }) as unknown as BlockLesson;

async function compute(c: Omit<Case, 'expected'>): Promise<Case> {
  const [n] = normalizeLessons([toBlock(c.lesson)], c.lang);
  const d = await toDesired(n!);
  return { ...c, expected: { id: d.id, hash: d.hash, body: d.body } };
}

describe('shared lesson fixture', () => {
  it('TS mapping equals the frozen fixture', async () => {
    const computed = await Promise.all(INPUTS.map(compute));
    if (process.env.UPDATE_GCAL_FIXTURES) writeFileSync(PATH, JSON.stringify(computed, null, 2) + '\n');
    expect(JSON.parse(readFileSync(PATH, 'utf8'))).toEqual(computed);
  });
});
```

- [ ] **Step 2: Run them to verify they fail.** `npx vitest run eventIdentity lessonFixture`. Expected: FAIL, missing modules.

- [ ] **Step 3: Implement**

`src/mobile/googleCalendar/eventIdentity.ts`:

```ts
import type { NormalizedEvent, ReisKind } from './types';

const ALPHABET = '0123456789abcdefghijklmnopqrstuv'; // Google event-id alphabet
const PREFIX: Record<ReisKind, string> = { lesson: 'l', exam: 'e', custom: 'c' };

export function base32hex(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return Array.from(await sha256(text), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function eventId(kind: ReisKind, key: string): Promise<string> {
  return PREFIX[kind] + base32hex(await sha256(key));
}

/** Unit separator: cannot appear in IS text, so field boundaries can't shift. */
const SEP = '\u001f';

export async function contentHash(n: NormalizedEvent): Promise<string> {
  const canonical = [n.kind, n.date, n.start, n.end, n.title, n.location, n.description].join(SEP);
  return (await sha256Hex(canonical)).slice(0, 16);
}
```

`src/mobile/googleCalendar/toGoogleEvent.ts`:

```ts
import { contentHash, eventId } from './eventIdentity';
import type { DesiredEvent, GoogleEventBody, NormalizedEvent } from './types';

const EXAM_COLOR = '11'; // Google "Tomato": exams must stand out among ~500 lessons

export async function toDesired(n: NormalizedEvent): Promise<DesiredEvent> {
  const [id, hash] = await Promise.all([eventId(n.kind, n.key), contentHash(n)]);
  const body: GoogleEventBody = {
    id,
    summary: n.title,
    location: n.location,
    description: n.description,
    start: { dateTime: `${n.date}T${n.start}:00`, timeZone: 'Europe/Prague' },
    end: { dateTime: `${n.date}T${n.end}:00`, timeZone: 'Europe/Prague' },
    reminders: n.kind === 'exam' ? { useDefault: true } : { useDefault: false, overrides: [] },
    ...(n.kind === 'exam' ? { colorId: EXAM_COLOR } : {}),
    extendedProperties: { private: { reisKind: n.kind, reisHash: hash, reisV: '1' } },
  };
  return { id, kind: n.kind, date: n.date, hash, body };
}
```

- [ ] **Step 4: Generate the fixture once, then verify it is stable**

Run: `UPDATE_GCAL_FIXTURES=1 npx vitest run lessonFixture && npx vitest run eventIdentity lessonFixture`
Expected: PASS. Inspect `__fixtures__/lessonEvents.json` by eye: titles read "Ekonomie I – přednáška", ids start with `l`.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/googleCalendar
git commit -m "feat(gcal): deterministic event ids, content hash and the shared lesson fixture"
```

### Task 5: The reconcile planner and its delete safeguards

**Files:**
- Create: `src/mobile/googleCalendar/plan.ts`, `src/mobile/googleCalendar/__fixtures__/lessonPlans.json`
- Test: `src/mobile/googleCalendar/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `DesiredEvent`, `ExistingEvent`, `ReisKind` (Task 3)
- Produces:

```ts
export interface PlanInput {
  kind: ReisKind;
  desired: DesiredEvent[]; // this kind only
  existing: ExistingEvent[]; // this kind only, as listed from Google
  today: string; // YYYY-MM-DD (Prague)
  includePast: boolean; // true only on the run that CREATED the calendar
  sourceConfirmed: boolean; // this kind's data came from a confirmed-successful read
  previousHeld: string | null; // fingerprint held back by the previous run, if any
}
export interface Plan {
  insert: DesiredEvent[];
  update: DesiredEvent[];
  remove: string[]; // event ids
  held: string | null; // fingerprint to persist; null = nothing held
}
export function planKind(input: PlanInput): Plan;
export function deleteFingerprint(ids: string[]): string;
```

- [ ] **Step 1: Write the failing test**, driven by the shared fixture. Java and Swift use the same file in Tasks 13 and 16.

`src/mobile/googleCalendar/__fixtures__/lessonPlans.json` (hand-written; it *is* the spec of the planner):

```json
[
  {
    "name": "inserts missing future, updates changed, deletes gone",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": null,
      "desired": [
        { "id": "la", "date": "2026-10-09", "hash": "1111" },
        { "id": "lb", "date": "2026-10-10", "hash": "2222" },
        { "id": "lc", "date": "2026-10-11", "hash": "3333" },
        { "id": "lf", "date": "2026-10-12", "hash": "6666" },
        { "id": "lg", "date": "2026-10-13", "hash": "7777" }
      ],
      "existing": [
        { "id": "lb", "date": "2026-10-10", "hash": "2222" },
        { "id": "lc", "date": "2026-10-11", "hash": "OLD" },
        { "id": "ld", "date": "2026-10-12", "hash": "4444" },
        { "id": "lg", "date": "2026-10-13", "hash": "7777" }
      ]
    },
    "expected": { "insert": ["la", "lf"], "update": ["lc"], "remove": ["ld"], "held": null }
  },
  {
    "name": "past is frozen unless this run created the calendar",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": null,
      "desired": [{ "id": "lp", "date": "2026-10-01", "hash": "NEW" }, { "id": "lq", "date": "2026-10-09", "hash": "q" }],
      "existing": [{ "id": "lp2", "date": "2026-10-02", "hash": "x" }, { "id": "lq", "date": "2026-10-09", "hash": "q" }]
    },
    "expected": { "insert": [], "update": [], "remove": [], "held": null }
  },
  {
    "name": "creating run writes the past too",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": true, "sourceConfirmed": true, "previousHeld": null,
      "desired": [{ "id": "lp", "date": "2026-10-01", "hash": "p" }, { "id": "lq", "date": "2026-10-09", "hash": "q" }],
      "existing": []
    },
    "expected": { "insert": ["lp", "lq"], "update": [], "remove": [], "held": null }
  },
  {
    "name": "unconfirmed source never deletes",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": false, "sourceConfirmed": false, "previousHeld": null,
      "desired": [],
      "existing": [{ "id": "lx", "date": "2026-10-09", "hash": "x" }]
    },
    "expected": { "insert": [], "update": [], "remove": [], "held": null }
  },
  {
    "name": "empty desired lessons is no information",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": null,
      "desired": [],
      "existing": [{ "id": "lx", "date": "2026-10-09", "hash": "x" }]
    },
    "expected": { "insert": [], "update": [], "remove": [], "held": null }
  },
  {
    "name": "mass delete is held back the first time",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": null,
      "desired": [{ "id": "l1", "date": "2026-10-09", "hash": "1" }],
      "existing": [
        { "id": "l1", "date": "2026-10-09", "hash": "1" },
        { "id": "l2", "date": "2026-10-09", "hash": "2" },
        { "id": "l3", "date": "2026-10-09", "hash": "3" }
      ]
    },
    "expected": { "insert": [], "update": [], "remove": [], "held": "l2,l3" }
  },
  {
    "name": "mass delete goes through when the previous run held the same set",
    "input": {
      "kind": "lesson", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": "l2,l3",
      "desired": [{ "id": "l1", "date": "2026-10-09", "hash": "1" }],
      "existing": [
        { "id": "l1", "date": "2026-10-09", "hash": "1" },
        { "id": "l2", "date": "2026-10-09", "hash": "2" },
        { "id": "l3", "date": "2026-10-09", "hash": "3" }
      ]
    },
    "expected": { "insert": [], "update": [], "remove": ["l2", "l3"], "held": null }
  },
  {
    "name": "custom may go empty (the student deleted their last event)",
    "input": {
      "kind": "custom", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": null,
      "desired": [],
      "existing": [{ "id": "c1", "date": "2026-10-09", "hash": "x" }]
    },
    "expected": { "insert": [], "update": [], "remove": ["c1"], "held": null }
  }
]
```

Notes on these cases:
- The first case removes 1 of 4 existing future events (`ld`); 1×3 is not more than 4, so nothing is held.
- In the last case the one-in-one deletion would exceed ⅓, but `custom` is exempt from both the empty rule and the ⅓ rule. The student's own deletions in reIS are authoritative.

`__tests__/plan.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planKind, deleteFingerprint, type PlanInput } from '../plan';
import type { DesiredEvent, ExistingEvent, ReisKind } from '../types';

type Raw = {
  name: string;
  input: Omit<PlanInput, 'desired' | 'existing'> & {
    desired: { id: string; date: string; hash: string }[];
    existing: { id: string; date: string; hash: string }[];
  };
  expected: { insert: string[]; update: string[]; remove: string[]; held: string | null };
};
const cases: Raw[] = JSON.parse(readFileSync(resolve(__dirname, '../__fixtures__/lessonPlans.json'), 'utf8'));

describe('planKind (shared fixture)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const kind = c.input.kind as ReisKind;
    const desired = c.input.desired.map((d) => ({ ...d, kind, body: {} }) as unknown as DesiredEvent);
    const existing = c.input.existing.map((e) => ({ ...e, kind }) as ExistingEvent);
    const p = planKind({ ...c.input, kind, desired, existing });
    expect({
      insert: p.insert.map((d) => d.id),
      update: p.update.map((d) => d.id),
      remove: p.remove,
      held: p.held,
    }).toEqual(c.expected);
  });
});

describe('deleteFingerprint', () => {
  it('is order-independent', () => {
    expect(deleteFingerprint(['b', 'a'])).toBe(deleteFingerprint(['a', 'b']));
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run plan.test`. Expected: FAIL, module missing.

- [ ] **Step 3: Implement** `src/mobile/googleCalendar/plan.ts`:

```ts
import type { DesiredEvent, ExistingEvent, ReisKind } from './types';

export interface PlanInput {
  kind: ReisKind;
  desired: DesiredEvent[];
  existing: ExistingEvent[];
  today: string;
  includePast: boolean;
  sourceConfirmed: boolean;
  previousHeld: string | null;
}

export interface Plan {
  insert: DesiredEvent[];
  update: DesiredEvent[];
  remove: string[];
  held: string | null;
}

export function deleteFingerprint(ids: string[]): string {
  return [...ids].sort().join(',');
}

/**
 * One kind, one run. Pure: same input, same plan, in TS, Java and Swift
 * (lessonPlans.json is the shared contract).
 *
 * Deletes are the dangerous half. IS answers "no lessons" and "query failed"
 * with the same bytes, so a delete needs a confirmed read, a non-empty
 * desired list (custom events excepted: they are local and authoritative)
 * and, past a third of the future, the same set seen twice in a row.
 */
export function planKind(input: PlanInput): Plan {
  const { kind, today, includePast } = input;
  const inScope = (date: string) => includePast || date >= today;
  const desired = input.desired.filter((d) => inScope(d.date));
  const existing = new Map(input.existing.filter((e) => inScope(e.date)).map((e) => [e.id, e]));
  const wanted = new Set(desired.map((d) => d.id));

  const insert = desired.filter((d) => !existing.has(d.id));
  const update = desired.filter((d) => {
    const e = existing.get(d.id);
    return e !== undefined && e.hash !== d.hash;
  });

  // Deletes are only ever considered from today on, even on a creating run.
  const futureExisting = input.existing.filter((e) => e.date >= today);
  const candidates = futureExisting.filter((e) => !wanted.has(e.id)).map((e) => e.id);

  const empty = { insert, update, remove: [] as string[], held: null };
  if (candidates.length === 0) return empty;
  if (!input.sourceConfirmed) return empty;
  if (kind !== 'custom' && input.desired.length === 0) return empty;

  const fingerprint = deleteFingerprint(candidates);
  const massive = kind !== 'custom' && candidates.length * 3 > futureExisting.length;
  if (massive && input.previousHeld !== fingerprint) {
    return { insert, update, remove: [], held: fingerprint };
  }
  return { insert, update, remove: candidates, held: null };
}
```

- [ ] **Step 4: Run it to verify it passes.** `npx vitest run plan.test`. Expected: 8 + 1 PASS.
- [ ] **Step 5: Commit**

```bash
git add src/mobile/googleCalendar
git commit -m "feat(gcal): reconcile planner with frozen past and delete safeguards"
```

### Task 6: The Google Calendar REST client

**Files:**
- Create: `src/mobile/googleCalendar/calendarApi.ts`
- Test: `src/mobile/googleCalendar/__tests__/calendarApi.test.ts`

**Note on batching (deliberate deviation from the spec):** Google counts every sub-request of a batch against the per-user quota, so batching saves only HTTP overhead. To stay under the quota, writes are **paced at 5 requests/second**: about 100 s for a ~500-event first fill, with progress shown. Task 6 Step 6 updates the spec's "Transport" paragraph to match.

**Interfaces:**
- Consumes: `DesiredEvent`, `ExistingEvent` (Task 3)
- Produces:

```ts
export const CALENDAR_MARKER = 'reis:rozvrh:v1';
export class CalendarGoneError extends Error {}
export class AuthRevokedError extends Error {}
export interface CalendarApiDeps {
  token: () => Promise<string>; // fresh access token from native
  invalidateToken: () => Promise<void>; // after a 401
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}
export function createCalendarApi(deps: CalendarApiDeps): {
  findReisCalendar(): Promise<string | null>;
  createCalendar(name: string): Promise<string>;
  assertCalendar(id: string): Promise<void>; // throws CalendarGoneError on 404
  listEvents(calendarId: string, kind: ReisKind, timeMin: string | null): Promise<ExistingEvent[]>;
  upsert(calendarId: string, d: DesiredEvent): Promise<void>; // POST, 409 → PUT confirmed
  put(calendarId: string, d: DesiredEvent): Promise<void>;
  remove(calendarId: string, id: string): Promise<void>; // 404/410 = already gone
};
```

- [ ] **Step 1: Write the failing tests**, with a fake `fetch` recording calls:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AuthRevokedError, CalendarGoneError, CALENDAR_MARKER, createCalendarApi } from '../calendarApi';
import type { DesiredEvent } from '../types';

type R = { status: number; body?: unknown };
function fakeFetch(responses: R[]) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    const r = responses.shift() ?? { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  });
  return { f: f as unknown as typeof fetch, calls };
}
const api = (responses: R[], invalidate = vi.fn(async () => {})) => {
  const { f, calls } = fakeFetch(responses);
  return { calls, invalidate, a: createCalendarApi({ token: async () => 'T', invalidateToken: invalidate, fetch: f, sleep: async () => {} }) };
};
const d = { id: 'lx', kind: 'lesson', date: '2026-10-09', hash: 'h', body: { id: 'lx', summary: 's' } } as unknown as DesiredEvent;

describe('calendarApi', () => {
  it('finds the reIS calendar by its description marker', async () => {
    const { a } = api([{ status: 200, body: { items: [
      { id: 'other', description: 'x', accessRole: 'owner' },
      { id: 'mine', description: `Rozvrh ${CALENDAR_MARKER}`, accessRole: 'owner' },
    ] } }]);
    expect(await a.findReisCalendar()).toBe('mine');
  });
  it('upsert falls back to PUT confirmed on 409', async () => {
    const { a, calls } = api([{ status: 409 }, { status: 200, body: {} }]);
    await a.upsert('cal', d);
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PUT']);
    expect(JSON.parse(calls[1]!.body!)).toMatchObject({ status: 'confirmed' });
    expect(calls[1]!.url).toContain('/calendars/cal/events/lx');
  });
  it('assertCalendar throws CalendarGoneError on 404', async () => {
    const { a } = api([{ status: 404 }]);
    await expect(a.assertCalendar('cal')).rejects.toBeInstanceOf(CalendarGoneError);
  });
  it('retries once after a 401 with a fresh token, then reports revoked', async () => {
    const { a, invalidate } = api([{ status: 401 }, { status: 401 }]);
    await expect(a.assertCalendar('cal')).rejects.toBeInstanceOf(AuthRevokedError);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it('backs off on 429 and on 403 rateLimitExceeded', async () => {
    const { a, calls } = api([
      { status: 429 },
      { status: 403, body: { error: { errors: [{ reason: 'rateLimitExceeded' }] } } },
      { status: 200, body: {} },
    ]);
    await a.put('cal', d);
    expect(calls).toHaveLength(3);
  });
  it('lists one kind, paginated, from timeMin', async () => {
    const ev = (id: string) => ({ id, start: { dateTime: '2026-10-09T09:00:00+02:00' },
      extendedProperties: { private: { reisKind: 'lesson', reisHash: 'h' } } });
    const { a, calls } = api([
      { status: 200, body: { items: [ev('l1')], nextPageToken: 'p2' } },
      { status: 200, body: { items: [ev('l2')] } },
    ]);
    const out = await a.listEvents('cal', 'lesson', '2026-10-08T00:00:00+02:00');
    expect(out).toEqual([
      { id: 'l1', kind: 'lesson', date: '2026-10-09', hash: 'h' },
      { id: 'l2', kind: 'lesson', date: '2026-10-09', hash: 'h' },
    ]);
    expect(calls[0]!.url).toContain('privateExtendedProperty=reisKind%3Dlesson');
    expect(calls[0]!.url).toContain('timeMin=');
    expect(calls[1]!.url).toContain('pageToken=p2');
  });
  it('treats 404 and 410 on delete as already gone', async () => {
    const { a } = api([{ status: 410 }]);
    await expect(a.remove('cal', 'lx')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run calendarApi`. Expected: FAIL.

- [ ] **Step 3: Implement** `src/mobile/googleCalendar/calendarApi.ts`:

```ts
import type { DesiredEvent, ExistingEvent, ReisKind } from './types';

export const CALENDAR_MARKER = 'reis:rozvrh:v1';
const BASE = 'https://www.googleapis.com/calendar/v3';
const PACE_MS = 200; // 5 req/s — Google's per-user quota counts batch parts too
const MAX_BACKOFF_TRIES = 5;

export class CalendarGoneError extends Error {}
export class AuthRevokedError extends Error {}
export class CalendarHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface CalendarApiDeps {
  token: () => Promise<string>;
  invalidateToken: () => Promise<void>;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

const enc = encodeURIComponent;

async function isRateLimited(res: Response): Promise<boolean> {
  if (res.status === 429) return true;
  if (res.status !== 403) return false;
  const body = (await res.clone().json().catch(() => null)) as {
    error?: { errors?: { reason?: string }[] };
  } | null;
  const reason = body?.error?.errors?.[0]?.reason ?? '';
  return reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded';
}

export function createCalendarApi(deps: CalendarApiDeps) {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      await deps.sleep(PACE_MS);
      const res = await deps.fetch(`${BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await deps.token()}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401) {
        if (refreshed) throw new AuthRevokedError('Google access was revoked');
        refreshed = true;
        await deps.invalidateToken();
        continue;
      }
      if ((await isRateLimited(res)) && attempt < MAX_BACKOFF_TRIES) {
        await deps.sleep(1000 * 2 ** attempt);
        continue;
      }
      return res;
    }
  }

  async function ok(res: Response, what: string): Promise<Response> {
    if (res.ok) return res;
    throw new CalendarHttpError(res.status, `${what} failed: HTTP ${res.status}`);
  }

  return {
    async findReisCalendar(): Promise<string | null> {
      let page: string | undefined;
      do {
        const q = `/users/me/calendarList?minAccessRole=owner&fields=items(id,description),nextPageToken${page ? `&pageToken=${enc(page)}` : ''}`;
        const json = (await (await ok(await request('GET', q), 'calendarList')).json()) as {
          items?: { id: string; description?: string }[];
          nextPageToken?: string;
        };
        const hit = json.items?.find((c) => c.description?.includes(CALENDAR_MARKER));
        if (hit) return hit.id;
        page = json.nextPageToken;
      } while (page);
      return null;
    },

    async createCalendar(name: string): Promise<string> {
      const res = await ok(
        await request('POST', '/calendars', {
          summary: name,
          timeZone: 'Europe/Prague',
          description: `${name} · reIS · ${CALENDAR_MARKER}`,
        }),
        'createCalendar'
      );
      return ((await res.json()) as { id: string }).id;
    },

    async assertCalendar(id: string): Promise<void> {
      const res = await request('GET', `/calendars/${enc(id)}?fields=id`);
      if (res.status === 404) throw new CalendarGoneError('Rozvrh was deleted in Google');
      await ok(res, 'getCalendar');
    },

    async listEvents(calendarId: string, kind: ReisKind, timeMin: string | null): Promise<ExistingEvent[]> {
      const out: ExistingEvent[] = [];
      let page: string | undefined;
      do {
        const params = new URLSearchParams({
          privateExtendedProperty: `reisKind=${kind}`,
          maxResults: '2500',
          fields: 'items(id,start,extendedProperties),nextPageToken',
        });
        if (timeMin) params.set('timeMin', timeMin);
        if (page) params.set('pageToken', page);
        const res = await ok(await request('GET', `/calendars/${enc(calendarId)}/events?${params}`), 'listEvents');
        const json = (await res.json()) as {
          items?: { id: string; start?: { dateTime?: string; date?: string }; extendedProperties?: { private?: Record<string, string> } }[];
          nextPageToken?: string;
        };
        for (const item of json.items ?? []) {
          const start = item.start?.dateTime ?? item.start?.date ?? '';
          out.push({ id: item.id, kind, date: start.slice(0, 10), hash: item.extendedProperties?.private?.reisHash ?? '' });
        }
        page = json.nextPageToken;
      } while (page);
      return out;
    },

    async upsert(calendarId: string, d: DesiredEvent): Promise<void> {
      const res = await request('POST', `/calendars/${enc(calendarId)}/events`, d.body);
      if (res.status === 409) return this.put(calendarId, d); // id kept reserved after a delete
      await ok(res, 'insertEvent');
    },

    async put(calendarId: string, d: DesiredEvent): Promise<void> {
      await ok(
        await request('PUT', `/calendars/${enc(calendarId)}/events/${enc(d.id)}`, { ...d.body, status: 'confirmed' }),
        'putEvent'
      );
    },

    async remove(calendarId: string, id: string): Promise<void> {
      const res = await request('DELETE', `/calendars/${enc(calendarId)}/events/${enc(id)}`);
      if (res.status === 404 || res.status === 410) return;
      await ok(res, 'deleteEvent');
    },
  };
}

export type CalendarApi = ReturnType<typeof createCalendarApi>;
```

- [ ] **Step 4: Run it to verify it passes.** `npx vitest run calendarApi`. Expected: PASS (7).
- [ ] **Step 5: Commit**

```bash
git add src/mobile/googleCalendar
git commit -m "feat(gcal): paced Calendar REST client with 409 restore, 401 refresh and backoff"
```

- [ ] **Step 6: Update the spec's Transport paragraph** to "paced single requests at 5/s; batching saves no quota", and commit as `docs(spec): ...`.

### Task 7: The sync runner

**Files:**
- Create: `src/mobile/googleCalendar/runSync.ts`
- Test: `src/mobile/googleCalendar/__tests__/runSync.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6
- Produces:

```ts
export interface SyncState {
  calendarId: string | null;
  held: Partial<Record<ReisKind, string>>;
  lastSyncAt: number | null;
}
export interface SyncSources {
  language: AppLanguage;
  lessons: BlockLesson[]; lessonsConfirmed: boolean;
  exams: ExamSubject[]; examsConfirmed: boolean;
  custom: CalendarCustomEvent[];
}
export type SyncOutcome =
  | { kind: 'ok'; state: SyncState; written: number }
  | { kind: 'calendarGone' }
  | { kind: 'revoked' };
export async function runSync(o: {
  api: CalendarApi;
  state: SyncState;
  sources: SyncSources;
  now: Date;
  onProgress?: (done: number, total: number) => void;
}): Promise<SyncOutcome>;
```

- [ ] **Step 1: Write the failing tests** with an in-memory fake `CalendarApi`:

```ts
import { describe, expect, it } from 'vitest';
import { runSync, type SyncSources } from '../runSync';
import { CalendarGoneError, type CalendarApi } from '../calendarApi';
import type { DesiredEvent, ExistingEvent } from '../types';

function fakeApi(opts: { found?: string | null; gone?: boolean } = {}) {
  const events = new Map<string, ExistingEvent>();
  const log: string[] = [];
  const api: CalendarApi = {
    findReisCalendar: async () => opts.found ?? null,
    createCalendar: async () => { log.push('create'); return 'new-cal'; },
    assertCalendar: async () => { if (opts.gone) throw new CalendarGoneError('x'); },
    listEvents: async (_c, kind, timeMin) =>
      [...events.values()].filter((e) => e.kind === kind && (!timeMin || e.date >= timeMin.slice(0, 10))),
    upsert: async (_c, d: DesiredEvent) => { log.push(`up:${d.id}`); events.set(d.id, { id: d.id, kind: d.kind, date: d.date, hash: d.hash }); },
    put: async (_c, d: DesiredEvent) => { log.push(`put:${d.id}`); events.set(d.id, { id: d.id, kind: d.kind, date: d.date, hash: d.hash }); },
    remove: async (_c, id) => { log.push(`del:${id}`); events.delete(id); },
  };
  return { api, events, log };
}

const lessonOn = (date: string) => ({
  id: date, date: date.replaceAll('-', ''), startTime: '09:00', endTime: '10:00', courseName: 'X',
  courseNameCs: 'X', courseNameEn: 'X', room: 'Q', roomCs: 'Q', roomEn: 'Q', isSeminar: 'false',
  teachers: [], roomStructured: { name: 'Q', id: '' },
}) as never;

const sources = (dates: string[]): SyncSources => ({
  language: 'cz', lessons: dates.map(lessonOn), lessonsConfirmed: true, exams: [], examsConfirmed: true, custom: [],
});
const NOW = new Date('2026-10-08T10:00:00+02:00');

describe('runSync', () => {
  it('creating run: makes the calendar and writes the past too', async () => {
    const { api, log } = fakeApi();
    const r = await runSync({ api, now: NOW, state: { calendarId: null, held: {}, lastSyncAt: null }, sources: sources(['2026-10-01', '2026-10-09']) });
    expect(r).toMatchObject({ kind: 'ok', written: 2, state: { calendarId: 'new-cal' } });
    expect(log.filter((l) => l.startsWith('up:'))).toHaveLength(2);
  });
  it('reusing an existing calendar never writes the past', async () => {
    const { api, log } = fakeApi({ found: 'theirs' });
    await runSync({ api, now: NOW, state: { calendarId: null, held: {}, lastSyncAt: null }, sources: sources(['2026-10-01', '2026-10-09']) });
    expect(log).not.toContain('create');
    expect(log.filter((l) => l.startsWith('up:'))).toHaveLength(1);
  });
  it('reports calendarGone when Rozvrh was deleted', async () => {
    const { api } = fakeApi({ gone: true });
    const r = await runSync({ api, now: NOW, state: { calendarId: 'cal', held: {}, lastSyncAt: 1 }, sources: sources(['2026-10-09']) });
    expect(r).toEqual({ kind: 'calendarGone' });
  });
  it('a second run with nothing changed writes nothing', async () => {
    const { api, log } = fakeApi();
    const first = await runSync({ api, now: NOW, state: { calendarId: null, held: {}, lastSyncAt: null }, sources: sources(['2026-10-09']) });
    log.length = 0;
    if (first.kind !== 'ok') throw new Error('first run failed');
    await runSync({ api, now: NOW, state: first.state, sources: sources(['2026-10-09']) });
    expect(log).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run runSync`. Expected: FAIL.

- [ ] **Step 3: Implement** `src/mobile/googleCalendar/runSync.ts`:

```ts
import type { BlockLesson, CalendarCustomEvent } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';
import { AuthRevokedError, CalendarGoneError, type CalendarApi } from './calendarApi';
import { normalizeCustom, normalizeExams, normalizeLessons } from './normalize';
import { planKind } from './plan';
import { pragueToday } from './pragueDate';
import { toDesired } from './toGoogleEvent';
import type { AppLanguage, DesiredEvent, ReisKind } from './types';

export interface SyncState {
  calendarId: string | null;
  held: Partial<Record<ReisKind, string>>;
  lastSyncAt: number | null;
}
export interface SyncSources {
  language: AppLanguage;
  lessons: BlockLesson[];
  lessonsConfirmed: boolean;
  exams: ExamSubject[];
  examsConfirmed: boolean;
  custom: CalendarCustomEvent[];
}
export type SyncOutcome =
  | { kind: 'ok'; state: SyncState; written: number }
  | { kind: 'calendarGone' }
  | { kind: 'revoked' };

const CALENDAR_NAME = 'Rozvrh';

/** 00:00 in Prague as RFC 3339. Prague is +01:00 or +02:00; take it from Intl. */
function pragueMidnight(today: string, now: Date): string {
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', timeZoneName: 'longOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')
    ?.value.replace('GMT', '') || '+01:00';
  return `${today}T00:00:00${offset}`;
}

export async function runSync(o: {
  api: CalendarApi;
  state: SyncState;
  sources: SyncSources;
  now: Date;
  onProgress?: (done: number, total: number) => void;
}): Promise<SyncOutcome> {
  const { api, sources, now } = o;
  const today = pragueToday(now);
  try {
    let calendarId = o.state.calendarId;
    let includePast = false;
    if (!calendarId) {
      calendarId = await api.findReisCalendar();
      if (!calendarId) {
        calendarId = await api.createCalendar(CALENDAR_NAME);
        includePast = true; // only the creating device writes history
      }
    }
    await api.assertCalendar(calendarId);

    const byKind: Record<ReisKind, { desired: DesiredEvent[]; confirmed: boolean }> = {
      lesson: { desired: await Promise.all(normalizeLessons(sources.lessons, sources.language).map(toDesired)), confirmed: sources.lessonsConfirmed },
      exam: { desired: await Promise.all(normalizeExams(sources.exams, sources.language).map(toDesired)), confirmed: sources.examsConfirmed },
      custom: { desired: await Promise.all(normalizeCustom(sources.custom).map(toDesired)), confirmed: true },
    };

    const timeMin = includePast ? null : pragueMidnight(today, now);
    const held: SyncState['held'] = {};
    const work: (() => Promise<void>)[] = [];
    for (const kind of ['lesson', 'exam', 'custom'] as const) {
      const existing = await api.listEvents(calendarId, kind, timeMin);
      const plan = planKind({
        kind, today, includePast,
        desired: byKind[kind].desired,
        existing,
        sourceConfirmed: byKind[kind].confirmed,
        previousHeld: o.state.held[kind] ?? null,
      });
      if (plan.held) held[kind] = plan.held;
      const cal = calendarId;
      plan.insert.forEach((d) => work.push(() => api.upsert(cal, d)));
      plan.update.forEach((d) => work.push(() => api.put(cal, d)));
      plan.remove.forEach((id) => work.push(() => api.remove(cal, id)));
    }

    for (let i = 0; i < work.length; i++) {
      await work[i]!();
      o.onProgress?.(i + 1, work.length);
    }
    return { kind: 'ok', written: work.length, state: { calendarId, held, lastSyncAt: now.getTime() } };
  } catch (e) {
    if (e instanceof CalendarGoneError) return { kind: 'calendarGone' };
    if (e instanceof AuthRevokedError) return { kind: 'revoked' };
    throw e;
  }
}
```

- [ ] **Step 4: Run it to verify it passes.** `npx vitest run src/mobile/googleCalendar`. Expected: all PASS.
- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/mobile/googleCalendar
git commit -m "feat(gcal): sync runner (create-or-reuse calendar, per-kind plans, progress)"
```

---

## Milestone 2: App integration (TypeScript)

### Task 8: Native plugin interface, store slice and persisted state

**Files:**
- Create: `src/mobile/googleCalendar/googleCalendarNative.ts`, `src/store/slices/createGoogleCalendarSlice.ts`, `src/mobile/googleCalendar/syncStateStore.ts`
- Modify: `src/store/types.ts` (add `GoogleCalendarSlice` to `AppState`), `src/store/useAppStore.ts` (compose the slice)
- Test: `src/store/slices/__tests__/createGoogleCalendarSlice.test.ts`, `src/mobile/googleCalendar/__tests__/syncStateStore.test.ts`

**Interfaces (produces):**

```ts
// googleCalendarNative.ts
export interface GoogleCalendarNativePlugin {
  isAvailable(): Promise<{ available: boolean }>; // Play Services present / not Mac-on-iPad (per Task 2)
  connect(): Promise<{ email: string | null }>; // consent UI on first use
  accessToken(): Promise<{ token: string }>; // silent; rejects 'REVOKED' when no grant
  invalidateToken(o: { token: string }): Promise<void>;
  disconnect(): Promise<void>; // revoke at Google + forget locally
  status(): Promise<{ connected: boolean; email: string | null }>;
  configure(o: { enabled: boolean; calendarId: string | null; studentId: string; studium: string; obdobi: string; language: 'cz' | 'en' }): Promise<void>;
  acquireLock(o: { owner: 'app' }): Promise<{ acquired: boolean }>;
  releaseLock(o: { owner: 'app' }): Promise<void>;
  takeBackgroundNotice(): Promise<{ notice: 'calendarGone' | 'revoked' | null }>; // set by the BG job
}
export const GoogleCalendarNative: GoogleCalendarNativePlugin; // registerPlugin('GoogleCalendar')

// createGoogleCalendarSlice.ts: STATE ONLY, imports nothing from src/mobile
export interface GoogleCalendarSlice {
  gcal: {
    available: boolean;
    connected: boolean;
    email: string | null;
    syncing: boolean;
    progress: { done: number; total: number } | null;
    lastSyncAt: number | null;
    notice: 'calendarGone' | 'revoked' | 'failed' | null;
  };
  setGcal: (patch: Partial<GoogleCalendarSlice['gcal']>) => void;
}

// syncStateStore.ts: persists SyncState + the last synced sources fingerprint via getPlatform().storage
export async function loadSyncState(): Promise<SyncState & { enabled: boolean; sourcesFingerprint: string | null }>;
export async function saveSyncState(s: SyncState & { enabled: boolean; sourcesFingerprint: string | null }): Promise<void>;
export async function clearSyncState(): Promise<void>;
```

- [ ] **Step 1: Write the failing slice test**

```ts
import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import { createGoogleCalendarSlice } from '../createGoogleCalendarSlice';
import type { GoogleCalendarSlice } from '../../types';

describe('createGoogleCalendarSlice', () => {
  it('starts disconnected and merges patches', () => {
    const s = create<GoogleCalendarSlice>()((set, get, api) => createGoogleCalendarSlice(set as never, get as never, api as never));
    expect(s.getState().gcal).toMatchObject({ connected: false, syncing: false, notice: null });
    s.getState().setGcal({ connected: true, email: 'a@b' });
    expect(s.getState().gcal).toMatchObject({ connected: true, email: 'a@b', syncing: false });
  });
});
```

Follow `createEduroamSlice.ts` for the exact `AppSlice` signature and how `useAppStore.ts` composes slices (read both first).

- [ ] **Step 2: Write the failing `syncStateStore` test.** Round-trip through a fake platform storage, the same way `src/mobile/__tests__` tests use `installPlatform`. Grep `installPlatform(` for the helper.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSyncState, loadSyncState, saveSyncState } from '../syncStateStore';
import { installTestPlatform } from './testPlatform';

describe('syncStateStore', () => {
  beforeEach(() => installTestPlatform());
  it('defaults to disabled and empty', async () => {
    expect(await loadSyncState()).toEqual({ enabled: false, calendarId: null, held: {}, lastSyncAt: null, sourcesFingerprint: null });
  });
  it('round-trips and clears', async () => {
    const s = { enabled: true, calendarId: 'c', held: { lesson: 'l1' }, lastSyncAt: 5, sourcesFingerprint: 'f' };
    await saveSyncState(s);
    expect(await loadSyncState()).toEqual(s);
    await clearSyncState();
    expect((await loadSyncState()).enabled).toBe(false);
  });
});
```

`src/mobile/googleCalendar/__tests__/testPlatform.ts`:

```ts
import { __resetPlatformForTests, setPlatform } from '../../../platform';
import type { ReisPlatform } from '../../../platform/types';

/** In-memory Capacitor-shaped platform for unit tests. */
export function installTestPlatform(): Map<string, unknown> {
  __resetPlatformForTests();
  const mem = new Map<string, unknown>();
  const storage = {
    get: async (k: string) => mem.get(k) ?? null,
    set: async (k: string, v: unknown) => void mem.set(k, structuredClone(v)),
    remove: async (k: string) => void mem.delete(k),
  };
  setPlatform({ kind: 'capacitor', storage, secureStorage: storage, getAssetUrl: (x: string) => x } as unknown as ReisPlatform);
  return mem;
}
```

If `PlatformStorage` in `src/platform/types.ts` has more members, add them as no-ops.

- [ ] **Step 3: Run both to verify they fail.** `npx vitest run createGoogleCalendarSlice syncStateStore`
- [ ] **Step 4: Implement**

`src/store/slices/createGoogleCalendarSlice.ts`:

```ts
import type { AppSlice, GoogleCalendarSlice } from '../types';

/**
 * State only. The work lives in src/mobile/googleCalendar, which the phone
 * tree installs from capacitor/startApp.ts. This file is composed into the
 * shared store, so it must import nothing from src/mobile — that is how the
 * extension's content script stays free of Google code
 * (desktopHasNoGoogleCalendar.test.ts).
 */
export const createGoogleCalendarSlice: AppSlice<GoogleCalendarSlice> = (set) => ({
  gcal: {
    available: false,
    connected: false,
    email: null,
    syncing: false,
    progress: null,
    lastSyncAt: null,
    notice: null,
  },
  setGcal: (patch) => set((s) => ({ gcal: { ...s.gcal, ...patch } })),
});
```

Add to `src/store/types.ts`, next to `EduroamSlice`:

```ts
export interface GoogleCalendarSlice {
  gcal: {
    available: boolean;
    connected: boolean;
    email: string | null;
    syncing: boolean;
    progress: { done: number; total: number } | null;
    lastSyncAt: number | null;
    notice: 'calendarGone' | 'revoked' | 'failed' | null;
  };
  setGcal: (patch: Partial<GoogleCalendarSlice['gcal']>) => void;
}
```

Add `GoogleCalendarSlice &` to the `AppState` intersection, and `...createGoogleCalendarSlice(...a)` in `useAppStore.ts`, exactly like `createEduroamSlice`.

`src/mobile/googleCalendar/googleCalendarNative.ts`:

```ts
import { registerPlugin } from '@capacitor/core';

/** One JS name, two native halves: GoogleCalendarPlugin.java and native/capacitor-google-calendar. */
export interface GoogleCalendarNativePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  connect(): Promise<{ email: string | null }>;
  accessToken(): Promise<{ token: string }>;
  invalidateToken(o: { token: string }): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<{ connected: boolean; email: string | null }>;
  configure(o: {
    enabled: boolean;
    calendarId: string | null;
    studentId: string;
    studium: string;
    obdobi: string;
    language: 'cz' | 'en';
  }): Promise<void>;
  acquireLock(o: { owner: 'app' }): Promise<{ acquired: boolean }>;
  releaseLock(o: { owner: 'app' }): Promise<void>;
  takeBackgroundNotice(): Promise<{ notice: 'calendarGone' | 'revoked' | null }>;
}

export const GoogleCalendarNative = registerPlugin<GoogleCalendarNativePlugin>('GoogleCalendar');
```

`src/mobile/googleCalendar/syncStateStore.ts`:

```ts
import { getPlatform } from '../../platform';
import type { SyncState } from './runSync';

const KEY = 'reis.gcal.state';
export type PersistedSync = SyncState & { enabled: boolean; sourcesFingerprint: string | null };
const EMPTY: PersistedSync = { enabled: false, calendarId: null, held: {}, lastSyncAt: null, sourcesFingerprint: null };

export async function loadSyncState(): Promise<PersistedSync> {
  const v = (await getPlatform().storage.get(KEY)) as Partial<PersistedSync> | null;
  return { ...EMPTY, ...(v ?? {}) };
}
export async function saveSyncState(s: PersistedSync): Promise<void> {
  await getPlatform().storage.set(KEY, s);
}
export async function clearSyncState(): Promise<void> {
  await getPlatform().storage.remove(KEY);
}
```

Check `src/platform/types.ts` for the exact `storage.get` signature; if it isn't generic, cast as shown.

- [ ] **Step 5: Run the tests, typecheck, commit**

```bash
npx vitest run createGoogleCalendarSlice syncStateStore
npm run typecheck
git add src/store src/mobile/googleCalendar
git commit -m "feat(gcal): native plugin interface, state-only slice and persisted sync state"
```

### Task 9: Triggers: install, connect, disconnect, sync on change

**Files:**
- Create: `src/mobile/googleCalendar/installGoogleCalendarSync.ts`, `src/mobile/googleCalendar/controller.ts`
- Modify: `capacitor/startApp.ts` (call `installGoogleCalendarSync()` after `installCalendarResumeReset()`)
- Test: `src/mobile/googleCalendar/__tests__/controller.test.ts`

**Interfaces:**
- Consumes: `runSync`, `createCalendarApi`, `GoogleCalendarNative`, `loadSyncState`/`saveSyncState`, `useAppStore` (`schedule`, `exams`, `customEvents`, `language`, `gcal`, `setGcal`), `getUserParams` (`src/utils/userParams.ts`), `isDemoMode` (`src/errors/demoMode.ts`)
- Produces:

```ts
export async function connectGoogleCalendar(): Promise<void>; // the sheet's "turn on"
export async function disconnectGoogleCalendar(o: { deleteCalendar: boolean }): Promise<void>;
export async function syncGoogleCalendarNow(reason: 'connect' | 'change'): Promise<void>;
export function sourcesFingerprint(sources: SyncSources): Promise<string>;
export function installGoogleCalendarSync(): void; // startApp
```

**Behaviour:**

- **`installGoogleCalendarSync`:**
  1. `isAvailable()` → `setGcal({ available })`.
  2. Load the state, then `status()` → `setGcal({ connected, email })`.
  3. `takeBackgroundNotice()` → if set, run the same handling as the outcomes below.
  4. `useAppStore.subscribe` on `schedule.data`, `exams.data`, `customEvents` and `language`, debounced 3 s → `syncGoogleCalendarNow('change')`.
- **`syncGoogleCalendarNow`:**
  1. Return early unless enabled, not demo mode, and the store's schedule status ≠ `loading`.
  2. Compute `sourcesFingerprint`; on `'change'`, return if it equals the stored one.
  3. `acquireLock({ owner: 'app' })`; return if not acquired.
  4. `setGcal({ syncing: true })` → `runSync` → handle the outcome → `configure(...)` → `releaseLock` (in `finally`).
- **Confirmation flags:**
  - `lessonsConfirmed = schedule.status === 'success' && schedule.data.length > 0`;
  - `examsConfirmed = exams.status === 'success'`.
- **Outcomes:**
  - `calendarGone`: `clearSyncState`, `configure({ enabled: false, ... })`, `setGcal({ connected: false, notice: 'calendarGone' })`. The calendar is not recreated.
  - `revoked`: the same, with `notice: 'revoked'`.
  - Thrown error: `logError('GoogleCalendar.sync', e)` and `setGcal({ notice: 'failed' })`. Keep the state; the next trigger retries.
- **`disconnectGoogleCalendar({ deleteCalendar })`:**
  - If `deleteCalendar` and the state has a `calendarId`: `DELETE /calendars/{id}` via the API. The `remove` helper deletes events, so add `deleteCalendar(id)` to `calendarApi` with a test: `DELETE /calendars/{id}`, 404/410 = ok.
  - Then `GoogleCalendarNative.disconnect()`, `clearSyncState()`, `configure({ enabled: false })`, `setGcal({ connected: false, email: null })`.

- [ ] **Step 1: Write the failing controller tests**, mocking `GoogleCalendarNative` with `vi.mock('../googleCalendarNative', ...)`. See the vitest-5 mock traps memory: mock at top level, never nested.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = {
  isAvailable: vi.fn(async () => ({ available: true })),
  connect: vi.fn(async () => ({ email: 'reis.mendelu@gmail.com' })),
  accessToken: vi.fn(async () => ({ token: 'T' })),
  invalidateToken: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  status: vi.fn(async () => ({ connected: true, email: 'reis.mendelu@gmail.com' })),
  configure: vi.fn(async () => {}),
  acquireLock: vi.fn(async () => ({ acquired: true })),
  releaseLock: vi.fn(async () => {}),
  takeBackgroundNotice: vi.fn(async () => ({ notice: null })),
};
vi.mock('../googleCalendarNative', () => ({ GoogleCalendarNative: native }));
const runSyncMock = vi.fn();
vi.mock('../runSync', () => ({ runSync: (...a: unknown[]) => runSyncMock(...a) }));

import { syncGoogleCalendarNow, connectGoogleCalendar } from '../controller';
import { loadSyncState, saveSyncState } from '../syncStateStore';
import { useAppStore } from '../../../store/useAppStore';
import { installTestPlatform } from './testPlatform';

beforeEach(async () => {
  installTestPlatform();
  vi.clearAllMocks();
  useAppStore.setState({
    schedule: { data: [{ id: '1' } as never], status: 'success' },
    exams: { data: [], status: 'success', error: null },
    customEvents: [],
    language: 'cz',
  } as never);
});

describe('controller', () => {
  it('connect enables, runs a sync and configures native', async () => {
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 1, state: { calendarId: 'c', held: {}, lastSyncAt: 1 } });
    await connectGoogleCalendar();
    expect((await loadSyncState()).enabled).toBe(true);
    expect(native.configure).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, calendarId: 'c' }));
    expect(useAppStore.getState().gcal.connected).toBe(true);
  });
  it('change with an unchanged fingerprint does nothing', async () => {
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 0, state: { calendarId: 'c', held: {}, lastSyncAt: 1 } });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).not.toHaveBeenCalled();
  });
  it('calendarGone turns the sync off and does not recreate', async () => {
    await saveSyncState({ enabled: true, calendarId: 'c', held: {}, lastSyncAt: 1, sourcesFingerprint: null });
    runSyncMock.mockResolvedValue({ kind: 'calendarGone' });
    await syncGoogleCalendarNow('change');
    expect((await loadSyncState()).enabled).toBe(false);
    expect(useAppStore.getState().gcal.notice).toBe('calendarGone');
  });
  it('skips when the lock is held by the background job', async () => {
    await saveSyncState({ enabled: true, calendarId: 'c', held: {}, lastSyncAt: 1, sourcesFingerprint: null });
    native.acquireLock.mockResolvedValueOnce({ acquired: false });
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run controller`
- [ ] **Step 3: Implement `controller.ts`** (keep it under ~200 lines; if it grows, split the outcome handling into `outcome.ts`):

```ts
import { GoogleCalendarNative } from './googleCalendarNative';
import { createCalendarApi } from './calendarApi';
import { runSync, type SyncSources } from './runSync';
import { clearSyncState, loadSyncState, saveSyncState } from './syncStateStore';
import { sha256Hex } from './eventIdentity';
import { useAppStore } from '../../store/useAppStore';
import { getUserParams } from '../../utils/userParams';
import { isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';

let cachedToken: string | null = null;

function api() {
  return createCalendarApi({
    token: async () => (cachedToken ??= (await GoogleCalendarNative.accessToken()).token),
    invalidateToken: async () => {
      if (cachedToken) await GoogleCalendarNative.invalidateToken({ token: cachedToken });
      cachedToken = null;
    },
    fetch: (...a) => fetch(...a),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
}

function currentSources(): SyncSources {
  const s = useAppStore.getState();
  return {
    language: s.language,
    lessons: s.schedule.data,
    lessonsConfirmed: s.schedule.status === 'success' && s.schedule.data.length > 0,
    exams: s.exams.data,
    examsConfirmed: s.exams.status === 'success',
    custom: s.customEvents,
  };
}

export async function sourcesFingerprint(src: SyncSources): Promise<string> {
  return sha256Hex(JSON.stringify([src.language, src.lessons, src.exams, src.custom]));
}

async function configureNative(enabled: boolean, calendarId: string | null) {
  const p = await getUserParams();
  await GoogleCalendarNative.configure({
    enabled,
    calendarId,
    studentId: p?.studentId ?? '',
    studium: p?.studium ?? '',
    obdobi: p?.obdobi ?? '',
    language: useAppStore.getState().language,
  });
}

async function turnOff(notice: 'calendarGone' | 'revoked' | null) {
  await clearSyncState();
  await configureNative(false, null);
  useAppStore.getState().setGcal({ connected: false, email: null, syncing: false, progress: null, notice });
}

export async function syncGoogleCalendarNow(reason: 'connect' | 'change'): Promise<void> {
  const st = await loadSyncState();
  if (!st.enabled || isDemoMode()) return;
  const sources = currentSources();
  const fp = await sourcesFingerprint(sources);
  if (reason === 'change' && fp === st.sourcesFingerprint) return;
  const { acquired } = await GoogleCalendarNative.acquireLock({ owner: 'app' });
  if (!acquired) return;
  const set = useAppStore.getState().setGcal;
  set({ syncing: true, notice: null });
  try {
    const out = await runSync({
      api: api(),
      state: st,
      sources,
      now: new Date(),
      onProgress: (done, total) => set({ progress: total > 20 ? { done, total } : null }),
    });
    if (out.kind === 'calendarGone' || out.kind === 'revoked') return await turnOff(out.kind);
    await saveSyncState({ ...out.state, enabled: true, sourcesFingerprint: fp });
    await configureNative(true, out.state.calendarId);
    set({ lastSyncAt: out.state.lastSyncAt });
  } catch (e) {
    logError('GoogleCalendar.sync', e, { reason });
    set({ notice: 'failed' });
  } finally {
    set({ syncing: false, progress: null });
    await GoogleCalendarNative.releaseLock({ owner: 'app' });
  }
}

export async function connectGoogleCalendar(): Promise<void> {
  try {
    const { email } = await GoogleCalendarNative.connect();
    const st = await loadSyncState();
    await saveSyncState({ ...st, enabled: true, sourcesFingerprint: null });
    useAppStore.getState().setGcal({ connected: true, email, notice: null });
    await syncGoogleCalendarNow('connect');
  } catch (e) {
    logError('GoogleCalendar.connect', e); // includes the student cancelling the consent sheet
  }
}

export async function disconnectGoogleCalendar(o: { deleteCalendar: boolean }): Promise<void> {
  const st = await loadSyncState();
  try {
    if (o.deleteCalendar && st.calendarId) await api().deleteCalendar(st.calendarId);
  } catch (e) {
    logError('GoogleCalendar.deleteCalendar', e);
  }
  await GoogleCalendarNative.disconnect().catch((e) => logError('GoogleCalendar.disconnect', e));
  cachedToken = null;
  await turnOff(null);
}
```

`installGoogleCalendarSync.ts`:

```ts
import { GoogleCalendarNative } from './googleCalendarNative';
import { loadSyncState } from './syncStateStore';
import { syncGoogleCalendarNow } from './controller';
import { useAppStore } from '../../store/useAppStore';
import { logError } from '../../utils/reportError';

const DEBOUNCE_MS = 3000;

/** Phone/iPad only. Called once from capacitor/startApp.ts. */
export function installGoogleCalendarSync(): void {
  void (async () => {
    try {
      const { available } = await GoogleCalendarNative.isAvailable();
      const st = await loadSyncState();
      const { connected, email } = await GoogleCalendarNative.status();
      const { notice } = await GoogleCalendarNative.takeBackgroundNotice();
      useAppStore.getState().setGcal({
        available,
        connected: connected && st.enabled && !notice,
        email,
        lastSyncAt: st.lastSyncAt,
        notice,
      });
    } catch (e) {
      logError('GoogleCalendar.install', e);
    }
  })();

  let timer: ReturnType<typeof setTimeout> | null = null;
  useAppStore.subscribe((s, prev) => {
    if (
      s.schedule.data === prev.schedule.data &&
      s.exams.data === prev.exams.data &&
      s.customEvents === prev.customEvents &&
      s.language === prev.language
    )
      return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncGoogleCalendarNow('change'), DEBOUNCE_MS);
  });
}
```

If the background job set a notice, `controller.turnOff` must also run once on install. Add `if (notice) await turnOff(notice)` by exporting `turnOff` from the controller.

Add `deleteCalendar(id)` to `calendarApi.ts`, with its test (`DELETE /calendars/{id}`; 404/410 ok):

```ts
    async deleteCalendar(id: string): Promise<void> {
      const res = await request('DELETE', `/calendars/${enc(id)}`);
      if (res.status === 404 || res.status === 410) return;
      await ok(res, 'deleteCalendar');
    },
```

`CalendarApi` now has this member, so also add `deleteCalendar: async () => {}` to `fakeApi` in `__tests__/runSync.test.ts`, or typecheck fails.

Wire into `capacitor/startApp.ts`: `import { installGoogleCalendarSync } from '@/mobile/googleCalendar/installGoogleCalendarSync';` and call it right after `installCalendarResumeReset();`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/mobile/googleCalendar capacitor && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/googleCalendar capacitor/startApp.ts
git commit -m "feat(gcal): connect, disconnect and sync-on-change for the phone tree"
```

### Task 10: The profile row and the Google Calendar sheet

**Files:**
- Create: `src/components/mobile/sheets/GoogleCalendarSheet.tsx`
- Modify: `src/components/mobile/screens/ProfileScreen.tsx` (a `NavRow` after eduroam, shown only when `gcal.available`), `src/store/types.ts` (sheet union `| { kind: 'googleCalendar' }`), `src/components/mobile/sheets/SheetHost.tsx` (a `case 'googleCalendar'`), `src/i18n/locales/cs.json` and `en.json`
- Test: `src/components/mobile/sheets/__tests__/GoogleCalendarSheet.test.tsx`, plus an extension to `src/components/mobile/screens/__tests__/ProfileScreenSettings.test.tsx`

**i18n keys** (new block `mobile.gcal`):

| key | cs | en |
| --- | --- | --- |
| `row` | Google Kalendář | Google Calendar |
| `rowOff` | Rozvrh, zkoušky a vlastní události | Timetable, exams and your own events |
| `rowOn` | Synchronizováno {{time}} | Synced {{time}} |
| `connect` | Synchronizovat s Google Kalendářem | Sync with Google Calendar |
| `explain` | reIS vytvoří ve tvém Googlu kalendář „Rozvrh" a bude ho udržovat aktuální, i na pozadí. Ostatní kalendáře nevidí ani nemění. | reIS creates a "Rozvrh" calendar in your Google account and keeps it current, also in the background. It cannot see or change your other calendars. |
| `account` | Účet: {{email}} | Account: {{email}} |
| `open` | Otevřít v Google Kalendáři | Open in Google Calendar |
| `progress` | Synchronizuji {{done}}/{{total}} | Syncing {{done}}/{{total}} |
| `offDelete` | Vypnout a smazat kalendář Rozvrh | Turn off and delete the Rozvrh calendar |
| `offKeep` | Jen vypnout | Turn off only |
| `revoked` | Přístup ke Google Kalendáři byl odebrán. | Access to Google Calendar was removed. |
| `gone` | Kalendář Rozvrh byl v Googlu smazán, synchronizace je vypnutá. | The Rozvrh calendar was deleted in Google, so sync is off. |
| `failed` | Synchronizace se nepovedla, zkusím to znovu. | Sync failed. I'll try again. |

"Open in Google Calendar" opens `https://calendar.google.com/` through the existing `src/mobile/openExternal.ts` helper. `google.com` is already an allowed deep-link host.

- [ ] **Step 1: Write the failing component tests.** Follow `EduroamSheet.test.tsx` for render helpers and how it mocks store state. Mock `../../../../mobile/googleCalendar/controller`.

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
const connect = vi.fn(async () => {});
const disconnect = vi.fn(async () => {});
vi.mock('../../../../mobile/googleCalendar/controller', () => ({
  connectGoogleCalendar: () => connect(),
  disconnectGoogleCalendar: (o: unknown) => disconnect(o),
}));
import { GoogleCalendarSheet } from '../GoogleCalendarSheet';
import { useAppStore } from '../../../../store/useAppStore';

describe('GoogleCalendarSheet', () => {
  it('offers connect when off', () => {
    useAppStore.getState().setGcal({ available: true, connected: false });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Synchronizovat s Google Kalendářem/ }));
    expect(connect).toHaveBeenCalled();
  });
  it('shows account and both turn-off choices when on', () => {
    useAppStore.getState().setGcal({ connected: true, email: 'reis.mendelu@gmail.com', lastSyncAt: Date.now() });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText(/reis.mendelu@gmail.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Jen vypnout/ }));
    expect(disconnect).toHaveBeenCalledWith({ deleteCalendar: false });
  });
  it('explains a deleted calendar', () => {
    useAppStore.getState().setGcal({ connected: false, notice: 'calendarGone' });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText(/byl v Googlu smazán/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run GoogleCalendarSheet`
- [ ] **Step 3: Implement the sheet.** DaisyUI classes only, no `useEffect`:

```tsx
import { CalendarCheck, Loader2 } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { connectGoogleCalendar, disconnectGoogleCalendar } from '../../../mobile/googleCalendar/controller';
import { openExternal } from '../../../mobile/openExternal';

export interface GoogleCalendarSheetProps {
  onClose: () => void;
}

const NOTICE_KEY = { revoked: 'mobile.gcal.revoked', calendarGone: 'mobile.gcal.gone', failed: 'mobile.gcal.failed' } as const;

export function GoogleCalendarSheet({ onClose }: GoogleCalendarSheetProps) {
  const { t } = useTranslation();
  const gcal = useAppStore((s) => s.gcal);
  const language = useAppStore((s) => s.language);
  const time = gcal.lastSyncAt
    ? new Date(gcal.lastSyncAt).toLocaleTimeString(language === 'cz' ? 'cs' : 'en', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('mobile.gcal.row')} onClose={onClose} />
      <div className="flex flex-col gap-3 px-4 pb-6">
        {gcal.notice && <p className="text-sm text-warning">{t(NOTICE_KEY[gcal.notice])}</p>}
        {!gcal.connected ? (
          <>
            <p className="text-sm text-base-content/70">{t('mobile.gcal.explain')}</p>
            <button type="button" className="btn btn-primary" onClick={() => void connectGoogleCalendar()}>
              <CalendarCheck size={16} /> {t('mobile.gcal.connect')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm">
              {gcal.syncing && gcal.progress
                ? t('mobile.gcal.progress', { done: gcal.progress.done, total: gcal.progress.total })
                : time && t('mobile.gcal.rowOn', { time })}
              {gcal.syncing && <Loader2 size={14} className="ml-2 inline animate-spin" />}
            </p>
            {gcal.email && <p className="text-xs text-base-content/70">{t('mobile.gcal.account', { email: gcal.email })}</p>}
            <button type="button" className="btn btn-ghost justify-start" onClick={() => openExternal('https://calendar.google.com/')}>
              {t('mobile.gcal.open')}
            </button>
            <button type="button" className="btn btn-outline btn-error" onClick={() => void disconnectGoogleCalendar({ deleteCalendar: true })}>
              {t('mobile.gcal.offDelete')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void disconnectGoogleCalendar({ deleteCalendar: false })}>
              {t('mobile.gcal.offKeep')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
```

Check the real export name of `src/mobile/openExternal.ts` and use it (`grep -n "^export" src/mobile/openExternal.ts`). The test renders `<GoogleCalendarSheet onClose={() => {}} />`. In `SheetHost.tsx`, add `case 'googleCalendar': return <GoogleCalendarSheet key={index} onClose={popSheet} />;`.
- [ ] **Step 4: Add the profile row:**

```tsx
{gcalAvailable && (
  <NavRow
    icon={CalendarSync}
    label={t('mobile.gcal.row')}
    sublabel={gcalConnected && lastSyncAt ? t('mobile.gcal.rowOn', { time }) : t('mobile.gcal.rowOff')}
    onClick={() => pushSheet({ kind: 'googleCalendar' })}
  />
)}
```

`CalendarSync` comes from `lucide-react` (check it exists in the installed version: `grep -l "CalendarSync" node_modules/lucide-react/dist/esm/icons/*.js`; otherwise use `CalendarCheck`). Add the sheet kind and the `SheetHost` case.
- [ ] **Step 5: Run tests and typecheck**, then verify the UI with the `verify-ui` skill: 320, 390, 430 and tablet width, both themes, row and sheet in both states. Send before/after PNGs to Dominik with `SendUserFile`.
- [ ] **Step 6: Commit**

```bash
git add src/components/mobile src/store/types.ts src/i18n/locales
git commit -m "feat(gcal): Google Calendar row in the profile sheet and its sheet"
```

### Task 11: Guards and privacy

**Files:**
- Create: `src/test/guards/desktopHasNoGoogleCalendar.test.ts`
- Modify: `privacy/disclosures.ts`, `scripts/privacy/check.ts`, `scripts/privacy/__tests__/*` (extend for the new flow variant), `src/test/guards/noStudentDataLeaves.test.ts`, `docs/privacy-policy-app.md`, `PRIVACY.md`, `privacy/play-data-safety.csv`

- [ ] **Step 1: Write the tree guard** (failing until the code exists, which it now does, so check that it passes and that it fails if you add a desktop import):

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Google Calendar sync is phone/iPad ONLY (spec 2026-10-08).
 * The extension cannot keep a Google token alive in the background without a
 * client secret: getAuthToken is Chrome-only, launchWebAuthFlow gives a
 * 1-hour token with no refresh, and a secret needs a relay server — the
 * shape of the Drive backup removed in 27dc1c326. The phone already keeps
 * the student's Google calendar current, which is the whole point.
 * Both halves are pinned so a later "reuse the sheet on desktop" fails here.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('Google Calendar sync placement', () => {
  it.each([
    'src/components/Sidebar/Sidebar.tsx',
    'src/components/AppMain.tsx',
    'src/components/AppOverlays.tsx',
    'src/store/slices/createGoogleCalendarSlice.ts',
  ])('%s does not reach src/mobile/googleCalendar', (file) => {
    expect(read(file)).not.toMatch(/mobile\/googleCalendar/);
  });

  it.each([
    ['capacitor/startApp.ts', 'installGoogleCalendarSync'],
    ['src/components/mobile/screens/ProfileScreen.tsx', 'googleCalendar'],
  ])('%s still has it', (file, needle) => {
    expect(read(file)).toContain(needle);
  });
});
```

Verify the exact paths of the desktop tree's top components first (`grep -n "AppMain\|AppOverlays\|Sidebar" src/App.tsx`). Also run the existing `contentScriptGraph` guard (`npx vitest run contentScriptGraph`).

- [ ] **Step 2: Extend the `Flow` type** in `privacy/disclosures.ts` with a discriminant. Existing flows default to Supabase:

```ts
export interface Flow {
  id: string;
  /** Where it goes. 'supabase' flows must appear in SUPABASE_CALLERS; 'third-party' flows declare their host. */
  via?: { kind: 'supabase' } | { kind: 'third-party'; host: string };
  // ...unchanged fields
}
```

In `scripts/privacy/check.ts` step 2, build `flowFiles` from **Supabase flows only**: `m.flows.filter((f) => f.via?.kind !== 'third-party')`. Add a test in `scripts/privacy/__tests__` proving a third-party flow's files are *not* required in `SUPABASE_CALLERS`, and that its `calls` may be `[]`.

- [ ] **Step 3: Add the flow:**

```ts
{
  id: 'google_calendar_sync',
  via: { kind: 'third-party', host: 'www.googleapis.com' },
  what: 'Only if the student turns it on: titles, times, rooms, teachers and notes of their lessons, exams and own events, written from the phone straight into a "Rozvrh" calendar in their own Google account. reIS reads the list of their calendars only to find that one. Nothing reaches a reIS server.',
  when: 'background',
  identifier: 'none',
  files: [
    'src/mobile/googleCalendar/calendarApi.ts',
    'android/app/src/main/java/cz/reis/app/gcal/CalendarHttp.java',
    'native/capacitor-google-calendar/ios/Sources/GoogleCalendarPlugin/CalendarHttp.swift',
  ],
  calls: [],
  policyRows: [
    [
      'Google Calendar sync',
      'only if you turn it on, then whenever your timetable changes',
      'your lessons, exams and own events, sent **from your phone straight to your own Google Calendar** ("Rozvrh"). reIS servers never see them. reIS can only change the calendar it created, and reads the list of your calendars only to find it',
    ],
  ],
  stores: {
    apple: [{ type: 'Other User Content', purpose: 'App Functionality', linked: true, tracking: false }],
    play: ['PSL_CALENDAR'],
    firefox: [],
    cws: [],
  },
},
```

- [ ] **Step 4: Play CSV.** In `privacy/play-data-safety.csv`, set `PSL_DATA_TYPES_CALENDAR,PSL_CALENDAR` to `true`, and its usage rows:
  - `PSL_DATA_USAGE_ONLY_COLLECTED` = `true`;
  - ephemeral = `false`;
  - `PSL_DATA_USAGE_USER_CONTROL_OPTIONAL` = `true`;
  - `PSL_APP_FUNCTIONALITY` = `true`.

  Follow the exact column format of the `PSL_USER_ACCOUNT` rows.
- [ ] **Step 5: Outbound hosts.** In `noStudentDataLeaves.test.ts` `ALLOWED_HOSTS`, under "fetched from, carrying student data", add:

```ts
  'googleapis.com', // Google Calendar sync — student's own calendar, phone only (privacy/disclosures.ts google_calendar_sync)
  'accounts.google.com', // the native Google sign-in sheet's endpoints
```

- [ ] **Step 6: Policies.**
  - Run `npm run privacy:generate` (regenerates the table in `docs/privacy-policy-app.md`).
  - Hand-add the Google API Services User Data Policy paragraph under the table in **both** `docs/privacy-policy-app.md` and `PRIVACY.md`:

    > reIS's use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. reIS uses Google Calendar access only to write your timetable into the calendar it created, and finds that calendar by reading your calendar list. It does not read your other events, and no Google data is sent to reIS or anyone else.

  - Bump **Last Updated** in both. Then grep `src` and `scripts` for both doc names and run those tests (memory note `policy-guard-tests-after-doc-edits`).
- [ ] **Step 7: Run the privacy and guard tests, then commit**

```bash
npx vitest run privacyDisclosures noStudentDataLeaves desktopHasNoGoogleCalendar contentScriptGraph scripts/privacy
git add privacy scripts/privacy src/test/guards docs/privacy-policy-app.md PRIVACY.md
git commit -m "feat(gcal): disclose the Google Calendar flow; pin it to the phone tree"
```

---

## Milestone 3: Android native

### Task 12: `GoogleCalendarPlugin.java` (foreground methods)

**Files:**
- Create: `android/app/src/main/java/cz/reis/app/GoogleCalendarPlugin.java`, `android/app/src/main/java/cz/reis/app/gcal/SyncConfig.java`
- Modify: `android/app/build.gradle` (`implementation 'com.google.android.gms:play-services-auth:22.0.0'`), `android/app/src/main/java/cz/reis/app/MainActivity.java` (`registerPlugin(GoogleCalendarPlugin.class);`)

**Interfaces:** implements every method of `GoogleCalendarNativePlugin` (Task 8). `SyncConfig` holds the non-secret config, the lock and the background notice, in SharedPreferences `reis_gcal`:

```java
public final class SyncConfig {
  public static final String PREFS = "reis_gcal";
  public static SyncConfig read(Context c);
  public void write(Context c);
  public boolean enabled; public String calendarId; public String studentId, studium, obdobi, language; public String heldLessons;
  public static boolean tryLock(Context c, String owner, long ttlMs); // atomic via commit()
  public static void unlock(Context c, String owner);
  public static void setNotice(Context c, String notice); public static String takeNotice(Context c);
}
```

**Before writing code:**
- Read `EduroamPlugin.java`, its `@CapacitorPlugin` annotation, and how it handles an activity result (`@ActivityCallback` plus `startActivityForResult(call, intent, "cb")`). Use the same mechanism for the `AuthorizationClient` `PendingIntent`: `startIntentSenderForResult` is not available on `PluginCall`, so wrap the `IntentSender` with an `ActivityResultLauncher<IntentSenderRequest>` registered in `load()`. The spike proved `ActivityResultContracts.StartIntentSenderForResult` works.
- Don't edit `SecureStorePlugin.java`, `EduroamPlugin.java` or `DownloadsPlugin.java`. They're device-verified (memory: don't reopen verified platform code).

- [ ] **Step 1: Implement.** Key methods:

```java
@CapacitorPlugin(name = "GoogleCalendar")
public class GoogleCalendarPlugin extends Plugin {
  static final List<Scope> SCOPES = Arrays.asList(
      new Scope("https://www.googleapis.com/auth/calendar.app.created"),
      new Scope("https://www.googleapis.com/auth/calendar.calendarlist.readonly"),
      new Scope("email"));
  private ActivityResultLauncher<IntentSenderRequest> consent;
  private PluginCall pendingConnect;

  static AuthorizationRequest request() {
    return AuthorizationRequest.builder().setRequestedScopes(SCOPES).build();
  }

  @Override public void load() {
    consent = getActivity().registerForActivityResult(
        new ActivityResultContracts.StartIntentSenderForResult(), r -> {
          PluginCall call = pendingConnect; pendingConnect = null;
          if (call == null) return;
          try {
            AuthorizationResult res = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(r.getData());
            resolveConnected(call, res);
          } catch (Exception e) { call.reject("CANCELLED"); }
        });
  }

  @PluginMethod public void isAvailable(PluginCall call) {
    int s = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());
    call.resolve(new JSObject().put("available", s == ConnectionResult.SUCCESS));
  }

  @PluginMethod public void connect(PluginCall call) {
    Identity.getAuthorizationClient(getActivity()).authorize(request())
      .addOnSuccessListener(res -> {
        if (res.hasResolution()) {
          pendingConnect = call;
          consent.launch(new IntentSenderRequest.Builder(res.getPendingIntent().getIntentSender()).build());
        } else resolveConnected(call, res);
      })
      .addOnFailureListener(e -> call.reject("AUTH_FAILED", e));
  }

  private void resolveConnected(PluginCall call, AuthorizationResult res) {
    // The email comes from the token's tokeninfo; fetch it once, off the main thread.
    new Thread(() -> {
      String email = fetchEmail(res.getAccessToken());
      getContext().getSharedPreferences(SyncConfig.PREFS, 0).edit().putString("email", email).apply();
      call.resolve(new JSObject().put("email", email));
    }).start();
  }

  @PluginMethod public void accessToken(PluginCall call) {
    Identity.getAuthorizationClient(getContext()).authorize(request())
      .addOnSuccessListener(res -> {
        if (res.hasResolution() || res.getAccessToken() == null) call.reject("REVOKED");
        else call.resolve(new JSObject().put("token", res.getAccessToken()));
      })
      .addOnFailureListener(e -> call.reject("AUTH_FAILED", e));
  }

  @PluginMethod public void invalidateToken(PluginCall call) {
    Identity.getAuthorizationClient(getContext())
      .clearToken(ClearTokenRequest.builder().setToken(call.getString("token")).build())
      .addOnCompleteListener(t -> call.resolve());
  }

  /** The `email` scope makes tokeninfo return the address. It never leaves the device. */
  static String fetchEmail(String token) {
    try {
      HttpURLConnection c = (HttpURLConnection) new URL(
          "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + URLEncoder.encode(token, "UTF-8")).openConnection();
      if (c.getResponseCode() != 200) return null;
      try (InputStream in = c.getInputStream()) {
        String body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        return new JSONObject(body).optString("email", null);
      }
    } catch (Exception e) {
      return null;
    }
  }

  @PluginMethod public void disconnect(PluginCall call) {
    String email = getContext().getSharedPreferences(SyncConfig.PREFS, 0).getString("email", null);
    Runnable forget = () -> {
      getContext().getSharedPreferences(SyncConfig.PREFS, 0).edit().clear().apply();
      call.resolve();
    };
    if (email == null) { forget.run(); return; }
    Identity.getAuthorizationClient(getContext())
        .revokeAccess(RevokeAccessRequest.builder()
            .setAccount(new Account(email, "com.google"))
            .setScopes(SCOPES)
            .build())
        .addOnCompleteListener(t -> forget.run()); // revoke failure still forgets locally
  }
  // status / configure / acquireLock / releaseLock / takeBackgroundNotice → SyncConfig
}
```

`configure` also schedules or cancels the background job (Task 14). Until Task 14 lands, leave a call to `CalendarSyncJobService.schedule(context, enabled)` that is a no-op stub returning immediately.

- [ ] **Step 2: Confirm the 22.0.0 API compiles as written:** `ClearTokenRequest`, `RevokeAccessRequest`, `AuthorizationClient.revokeAccess`. If `revokeAccess` is absent in this version, `disconnect` falls back to `clearToken` plus forgetting locally. Record that in the PR (the student can still revoke at myaccount.google.com).
- [ ] **Step 3: Check the merged manifest** (privacy check, spec point 4): `npm run android:apk`, then `~/Library/Android/sdk/cmdline-tools/latest/bin/apkanalyzer manifest permissions android/app/build/outputs/apk/release/app-release.apk`. If anything beyond the current `PLATFORM_PERMISSIONS.android` appears (e.g. `ACCESS_NETWORK_STATE`), add it to `privacy/disclosures.ts` and re-run `npx vitest run privacyDisclosures`.
- [ ] **Step 4: Device check on the Pixel**, signed in as `reis.mendelu`: install with `npm run android:push`, open Profil → Google Kalendář → Synchronizovat. Expect the account picker and consent screen, then "Rozvrh" appears at calendar.google.com, filled by the TS runner. Count: `adb logcat` has no `GoogleCalendar.*` errors, and the event count for this week matches reIS.
- [ ] **Step 5: Commit**

```bash
git add android/app
git commit -m "feat(gcal/android): GoogleCalendar plugin — consent, silent token, config and lock"
```

### Task 13: Java ports of the lesson mapping and the planner (with the shared fixtures)

**Files:**
- Create: `android/app/src/main/java/cz/reis/app/gcal/LessonMapper.java`, `android/app/src/main/java/cz/reis/app/gcal/LessonPlanner.java`
- Test: `android/app/src/test/java/cz/reis/app/gcal/LessonMapperTest.java`, `android/app/src/test/java/cz/reis/app/gcal/LessonPlannerTest.java`
- Modify: `android/app/build.gradle` (`testImplementation 'org.json:json:20240303'` so `org.json` works on the JVM)

**Interfaces:** `LessonMapper.map(JSONObject isLesson, String lang)` → `Desired { String id; String date; String hash; JSONObject body; }`, where the input is one IS `blockLessons[]` item. `LessonPlanner.plan(...)` mirrors `planKind` for `kind = lesson`, with `includePast = false` always.

- [ ] **Step 1: Write the failing JUnit tests**, reading the TS fixtures from the repo:

```java
public class LessonMapperTest {
  @Test public void matchesTheSharedFixture() throws Exception {
    String json = new String(Files.readAllBytes(Paths.get("../../src/mobile/googleCalendar/__fixtures__/lessonEvents.json")), StandardCharsets.UTF_8);
    JSONArray cases = new JSONArray(json);
    for (int i = 0; i < cases.length(); i++) {
      JSONObject c = cases.getJSONObject(i);
      JSONObject l = c.getJSONObject("lesson");
      JSONObject is = new JSONObject()
        .put("id", l.getString("id")).put("date", l.getString("date"))
        .put("startTime", l.getString("startTime")).put("endTime", l.getString("endTime"))
        .put("courseName", l.getString("courseName")).put("room", l.getString("room"))
        .put("isSeminar", l.getString("isSeminar"));
      JSONArray teachers = new JSONArray();
      JSONArray names = l.getJSONArray("teachers");
      for (int t = 0; t < names.length(); t++) teachers.put(new JSONObject().put("fullName", names.getString(t)));
      is.put("teachers", teachers);
      LessonMapper.Desired d = LessonMapper.map(is, c.getString("lang"));
      JSONObject exp = c.getJSONObject("expected");
      assertEquals(c.getString("name"), exp.getString("id"), d.id);
      assertEquals(c.getString("name"), exp.getString("hash"), d.hash);
      JSONObject eb = exp.getJSONObject("body");
      assertEquals(eb.getString("summary"), d.body.getString("summary"));
      assertEquals(eb.getString("location"), d.body.getString("location"));
      assertEquals(eb.getString("description"), d.body.getString("description"));
      assertEquals(eb.getJSONObject("start").getString("dateTime"), d.body.getJSONObject("start").getString("dateTime"));
    }
  }
}
```

`LessonPlannerTest` iterates `lessonPlans.json` and asserts `insert`/`update`/`remove`/`held` id lists, **skipping cases whose `kind` ≠ `lesson` and cases with `includePast: true`** (the background job never creates calendars).

- [ ] **Step 2: Run them to verify they fail.**

Run: `cd android && ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew testReleaseUnitTest --tests 'cz.reis.app.gcal.*'`
Expected: FAIL (compile errors).

- [ ] **Step 3: Implement `LessonMapper`.** It must reproduce TS byte for byte:
  - `key = id + "|" + date + "|" + startTime`;
  - `id = "l" + base32hex(sha256(key))`, using the alphabet `0123456789abcdefghijklmnopqrstuv` and the bit loop from `eventIdentity.ts`;
  - `title = courseName + " – " + (isSeminar.equals("true") ? LABEL.seminar : LABEL.lecture)` (en-dash U+2013 with spaces), labels `cz`: `přednáška`/`cvičení`, `en`: `lecture`/`seminar`;
  - `description = teachers.isEmpty() ? "reIS" : String.join(", ", teachers) + "\nreIS"`;
  - `hash = first 16 hex of sha256(String.join("\u001f", "lesson", date, start, end, title, location, description))`, with `date` as `yyyy-MM-dd`;
  - `body`: the same shape as `toGoogleEvent.ts` for lessons: `reminders {useDefault:false, overrides:[]}`, no `colorId`, `extendedProperties.private {reisKind:"lesson", reisHash, reisV:"1"}`.

  Use `MessageDigest.getInstance("SHA-256")` and `StandardCharsets.UTF_8`.
  Code:

```java
package cz.reis.app.gcal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Port of normalize.ts (lessons) + eventIdentity.ts + toGoogleEvent.ts. Held to lessonEvents.json. */
public final class LessonMapper {
  public static final class Desired { public String id, date, hash; public JSONObject body; }
  private static final String ALPHABET = "0123456789abcdefghijklmnopqrstuv";
  private static final String SEP = "\u001f";

  static String base32hex(byte[] bytes) {
    StringBuilder out = new StringBuilder();
    int buffer = 0, bits = 0;
    for (byte b : bytes) {
      buffer = (buffer << 8) | (b & 0xff);
      bits += 8;
      while (bits >= 5) { out.append(ALPHABET.charAt((buffer >>> (bits - 5)) & 31)); bits -= 5; }
      buffer &= (1 << bits) - 1;
    }
    if (bits > 0) out.append(ALPHABET.charAt((buffer << (5 - bits)) & 31));
    return out.toString();
  }

  static byte[] sha256(String s) throws Exception {
    return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
  }

  static String hex(byte[] b) {
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format("%02x", x & 0xff));
    return sb.toString();
  }

  public static Desired map(JSONObject l, String lang) throws Exception {
    boolean en = "en".equals(lang);
    String raw = l.getString("date");
    String date = raw.substring(0, 4) + "-" + raw.substring(4, 6) + "-" + raw.substring(6, 8);
    String start = l.getString("startTime"), end = l.getString("endTime");
    String type = "true".equals(l.optString("isSeminar")) ? (en ? "seminar" : "cvičení") : (en ? "lecture" : "přednáška");
    String title = l.getString("courseName") + " \u2013 " + type;
    String location = l.optString("room", "");
    List<String> teachers = new ArrayList<>();
    JSONArray ts = l.optJSONArray("teachers");
    if (ts != null) for (int i = 0; i < ts.length(); i++) {
      String n = ts.getJSONObject(i).optString("fullName", "");
      if (!n.isEmpty()) teachers.add(n);
    }
    String description = teachers.isEmpty() ? "reIS" : String.join(", ", teachers) + "\nreIS";
    String key = l.getString("id") + "|" + raw + "|" + start;

    Desired d = new Desired();
    d.id = "l" + base32hex(sha256(key));
    d.date = date;
    d.hash = hex(sha256(String.join(SEP, "lesson", date, start, end, title, location, description))).substring(0, 16);
    d.body = new JSONObject()
        .put("id", d.id).put("summary", title).put("location", location).put("description", description)
        .put("start", new JSONObject().put("dateTime", date + "T" + start + ":00").put("timeZone", "Europe/Prague"))
        .put("end", new JSONObject().put("dateTime", date + "T" + end + ":00").put("timeZone", "Europe/Prague"))
        .put("reminders", new JSONObject().put("useDefault", false).put("overrides", new JSONArray()))
        .put("extendedProperties", new JSONObject().put("private",
            new JSONObject().put("reisKind", "lesson").put("reisHash", d.hash).put("reisV", "1")));
    return d;
  }
}
```

  The `\u001f`, `\u2013` and `\n` above are Java escape sequences inside string literals, i.e. single characters at runtime.

- [ ] **Step 4: Implement `LessonPlanner`** as a line-for-line port of `planKind` (with `includePast = false` and `kind = lesson`):

```java
package cz.reis.app.gcal;

import java.util.*;

public final class LessonPlanner {
  public static final class Existing { public String id, date, hash; }
  public static final class Plan {
    public List<LessonMapper.Desired> insert = new ArrayList<>(), update = new ArrayList<>();
    public List<String> remove = new ArrayList<>();
    public String held;
  }

  public static String fingerprint(List<String> ids) {
    List<String> s = new ArrayList<>(ids); Collections.sort(s); return String.join(",", s);
  }

  public static Plan plan(List<LessonMapper.Desired> desiredAll, List<Existing> existingAll, String today,
                          boolean sourceConfirmed, String previousHeld) {
    Plan p = new Plan();
    Map<String, Existing> existing = new HashMap<>();
    List<Existing> future = new ArrayList<>();
    for (Existing e : existingAll) if (e.date.compareTo(today) >= 0) { existing.put(e.id, e); future.add(e); }
    Set<String> wanted = new HashSet<>();
    for (LessonMapper.Desired d : desiredAll) {
      if (d.date.compareTo(today) < 0) continue;
      wanted.add(d.id);
      Existing e = existing.get(d.id);
      if (e == null) p.insert.add(d); else if (!e.hash.equals(d.hash)) p.update.add(d);
    }
    List<String> candidates = new ArrayList<>();
    for (Existing e : future) if (!wanted.contains(e.id)) candidates.add(e.id);
    if (candidates.isEmpty() || !sourceConfirmed || desiredAll.isEmpty()) return p;
    String fp = fingerprint(candidates);
    if (candidates.size() * 3 > future.size() && !fp.equals(previousHeld)) { p.held = fp; return p; }
    p.remove = candidates;
    return p;
  }
}
```
- [ ] **Step 5: Run the tests to verify they pass.** Same gradle command. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add android/app
git commit -m "feat(gcal/android): Java lesson mapper and planner, held to the shared fixtures"
```

### Task 14: `CalendarSyncJobService` (background lessons sync)

**Files:**
- Create: `android/app/src/main/java/cz/reis/app/gcal/CalendarSyncJobService.java`, `IsTimetable.java`, `SecureStoreReader.java`, `CalendarHttp.java`
- Modify: `android/app/src/main/AndroidManifest.xml` (declare the service with `android:permission="android.permission.BIND_JOB_SERVICE" android:exported="false"`)
- Test: `android/app/src/test/java/cz/reis/app/gcal/SecureStoreReaderTest.java` (constants match `SecureStorePlugin`)

**Design** (spec, facts 2–4):
- **Schedule:** `JobInfo.Builder(4712, …)`, `.setPeriodic(6h, 1h flex)`, `.setRequiredNetworkType(NETWORK_TYPE_ANY)`, `.setPersisted(true)`.
- **`schedule(context, enabled)`:** schedules when enabled, `cancel(4712)` otherwise.
- **`onStartJob`:** `return true`, do the work on a thread, call `jobFinished(params, false)` in `finally`.
- **Steps:**
  1. `SyncConfig.read`; stop unless `enabled && calendarId != null`.
  2. `SyncConfig.tryLock(ctx, "job", 5 min)`; stop if held.
  3. `SecureStoreReader.read(ctx, "reis.session.uisAuth")`; stop if null. **Only read this.** It copies the constants `PREFS="reis_secure_store"`, `KEY_ALIAS="reis.securestore.v1"`, AES/GCM and the IV length from `SecureStorePlugin`, which stays untouched, and the unit test asserts the copies still match the plugin's source text.
  4. `IsTimetable.fetch(ctx, token, cfg)`:
     - POST `https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl?lang=<lang>` with the same form fields as `src/api/schedule.ts` `fetchWeekSchedule`, the window from `academicWindow` (ported), and the header `Cookie: UISAuth=<token>`;
     - JSON → `blockLessons`;
     - non-JSON → `null` (no info). The "no results" HTML also returns `null` here: the background job never deletes on emptiness.
  5. Map with `LessonMapper`, keep date ≥ Prague today.
  6. Get a token with `Identity.getAuthorizationClient(getApplicationContext()).authorize(GoogleCalendarPlugin.request())` and `Tasks.await(…, 30 s)`. On `hasResolution` → `SyncConfig.setNotice("revoked")`, `enabled=false`, stop.
  7. `CalendarHttp.getCalendar` → 404 → `setNotice("calendarGone")`, `enabled=false`, stop.
  8. `CalendarHttp.listEvents(lesson, timeMin = Prague midnight)` → `LessonPlanner.plan(...)` → upsert (POST, 409 → PUT confirmed) / PUT / DELETE, sequentially at 200 ms pacing; persist `heldLessons`.
  9. `SyncConfig.unlock(ctx, "job")` in `finally`.
- **Logging:** `Log.w("ReisGcal", …)` with the step name only. Never log tokens, titles or ids.

- [ ] **Step 1: Write the failing `SecureStoreReaderTest`.** It reads `SecureStorePlugin.java` as text and asserts it contains the reader's `PREFS`, `KEY_ALIAS` and transformation literals.
- [ ] **Step 2: Implement the four classes** and the manifest entry. Then replace the Task 12 stub with the real `schedule()`.
- [ ] **Step 3: Unit tests:** `./gradlew testReleaseUnitTest --tests 'cz.reis.app.gcal.*'` → PASS.
- [ ] **Step 4: Device verification on the Pixel**, release build via `npm run android:push`, connected as `reis.mendelu`. Do each of these:
  - check the cookie actually reaches IS from the job's process: the fetch returns JSON, not the login HTML (log the content-type only). If it fails, report rather than switching to CapacitorHttp; the Android cookie-jar note in `capacitorTransport.ts` explains why;
  - in Google Calendar, delete one **future** "Rozvrh" lesson; then `adb shell am kill cz.reis.app` and `adb shell cmd jobscheduler run -f cz.reis.app 4712`; the logcat `ReisGcal` steps should show it re-created (409 → PUT);
  - delete one **past** lesson in Google, run again: it does **not** come back;
  - turn Battery Saver on: `cmd jobscheduler run -f` still forces it, but a natural run waits; then turn it off;
  - turn Background data off for reIS and confirm the job waits for the network constraint. Ask Dominik to flip these settings; never change them over adb.
- [ ] **Step 5: Commit**

```bash
git add android/app
git commit -m "feat(gcal/android): background JobService keeps future lessons in sync"
```

---

## Milestone 4: iOS native

### Task 15: `native/capacitor-google-calendar` (foreground methods)

**Files:**
- Create: `native/capacitor-google-calendar/package.json`, `Package.swift`, `ios/Sources/GoogleCalendarPlugin/GoogleCalendarPlugin.swift`, `ios/Sources/GoogleCalendarPlugin/SyncConfig.swift`
- Modify: root `package.json` (`"@reis/capacitor-google-calendar": "file:native/capacitor-google-calendar"`), `ios/App/App/Info.plist` (`GIDClientID`, URL scheme = reversed client id, `UIBackgroundModes` → `fetch`, `BGTaskSchedulerPermittedIdentifiers` → `cz.reis.app.calendar-sync`), `ios/App/App/SceneDelegate.swift` (`GIDSignIn.sharedInstance.handle(url)` in `openURLContexts`), `src/test/guards/nativePluginsAreReachable.test.ts` (if it lists plugins)

**Pattern:** copy `native/capacitor-eduroam`'s `package.json` and `Package.swift` shape **exactly**. The package/product name is derived from the npm name: `@reis/capacitor-google-calendar` → `ReisCapacitorGoogleCalendar`, target `GoogleCalendarPlugin`. Add the dependency `.package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "10.0.0")` with the product `GoogleSignIn`.

- [ ] **Step 1: Implement the plugin methods** (`@objc(GoogleCalendarPlugin)`, `jsName = "GoogleCalendar"`):
  - `isAvailable`: `!ProcessInfo.processInfo.isiOSAppOnMac`, or `true` if Task 2 proved the Mac works.
  - `connect`: `GIDSignIn.sharedInstance.signIn(withPresenting: bridge.viewController, hint: nil, additionalScopes: [calendar.app.created, calendar.calendarlist.readonly])`. GoogleSignIn adds `email`/`profile`/`openid` itself, which covers the email scope. Resolve with `{ email: result.user.profile?.email }`.
  - `accessToken`: `restorePreviousSignIn` if `currentUser` is nil → `currentUser.refreshTokensIfNeeded` → `{ token }`; reject `REVOKED` if there's no user or the scopes are missing.
  - `invalidateToken`: no-op. GoogleSignIn refreshes on expiry; a 401 retry calls `refreshTokensIfNeeded` again.
  - `disconnect`: `GIDSignIn.sharedInstance.disconnect`.
  - `status`, `configure`, `acquireLock`, `releaseLock`, `takeBackgroundNotice` → `SyncConfig` (UserDefaults suite `cz.reis.app.gcal`). The lock is a timestamp plus owner, written with a compare-before-write under `os_unfair_lock` inside the process. iOS runs the BG task in the same process as the app.
- [ ] **Step 2: Build, sync, install a release build on the cabled iPad** (`ipad-device` memory), connect as `reis.mendelu`, and check that "Rozvrh" fills at calendar.google.com.
- [ ] **Step 3: Run `npx vitest run nativePluginsAreReachable privacyDisclosures`**: the Info.plist got no new `NS*UsageDescription`, so `PLATFORM_PERMISSIONS.ios` is unchanged.
- [ ] **Step 4: Commit**

```bash
git add native/capacitor-google-calendar package.json package-lock.json ios/App/App
git commit -m "feat(gcal/ios): GoogleCalendar plugin — GoogleSignIn consent, silent token, config and lock"
```

### Task 16: Swift ports of the mapper and the planner (with the shared fixtures)

**Files:**
- Create: `native/capacitor-google-calendar/ios/Sources/GoogleCalendarPlugin/LessonMapper.swift`, `LessonPlanner.swift`
- Create: `native/capacitor-google-calendar/ios/Tests/GoogleCalendarPluginTests/LessonMapperTests.swift`, `LessonPlannerTests.swift`
- Modify: `Package.swift` (a `testTarget`)

- [ ] **Step 1: Write the failing XCTests.** Read the fixtures via `URL(fileURLWithPath: #filePath)` → up to the repo root → `src/mobile/googleCalendar/__fixtures__/…`, then make the same assertions as the Java tests.
- [ ] **Step 2: Run them to verify they fail.** `cd native/capacitor-google-calendar && swift test` (or the `PdfInk`-style scheme from Xcode; see memory `pdfink-swift-tests`).
- [ ] **Step 3: Implement** `LessonMapper.swift` (and `LessonPlanner.swift`, a line-for-line port of the Java planner above):

```swift
import CryptoKit
import Foundation

/// Port of normalize.ts (lessons) + eventIdentity.ts + toGoogleEvent.ts. Held to lessonEvents.json.
enum LessonMapper {
    struct Desired { let id: String; let date: String; let hash: String; let body: [String: Any] }
    private static let alphabet = Array("0123456789abcdefghijklmnopqrstuv")

    static func base32hex(_ bytes: [UInt8]) -> String {
        var out = ""; var buffer: UInt32 = 0; var bits = 0
        for b in bytes {
            buffer = (buffer << 8) | UInt32(b); bits += 8
            while bits >= 5 { out.append(alphabet[Int((buffer >> UInt32(bits - 5)) & 31)]); bits -= 5 }
            buffer &= (1 << UInt32(bits)) - 1
        }
        if bits > 0 { out.append(alphabet[Int((buffer << UInt32(5 - bits)) & 31)]) }
        return out
    }

    static func sha256(_ s: String) -> [UInt8] { Array(SHA256.hash(data: Data(s.utf8))) }

    static func map(_ l: [String: Any], lang: String) -> Desired {
        let en = lang == "en"
        let raw = l["date"] as? String ?? ""
        let date = "\(raw.prefix(4))-\(raw.dropFirst(4).prefix(2))-\(raw.dropFirst(6).prefix(2))"
        let start = l["startTime"] as? String ?? "", end = l["endTime"] as? String ?? ""
        let seminar = (l["isSeminar"] as? String) == "true"
        let type = seminar ? (en ? "seminar" : "cvičení") : (en ? "lecture" : "přednáška")
        let title = "\(l["courseName"] as? String ?? "") \u{2013} \(type)"
        let location = l["room"] as? String ?? ""
        let teachers = (l["teachers"] as? [[String: Any]] ?? []).compactMap { $0["fullName"] as? String }.filter { !$0.isEmpty }
        let description = teachers.isEmpty ? "reIS" : teachers.joined(separator: ", ") + "\nreIS"
        let key = "\(l["id"] as? String ?? "")|\(raw)|\(start)"
        let id = "l" + base32hex(sha256(key))
        let canonical = ["lesson", date, start, end, title, location, description].joined(separator: "\u{1F}")
        let hash = String(sha256(canonical).map { String(format: "%02x", $0) }.joined().prefix(16))
        let body: [String: Any] = [
            "id": id, "summary": title, "location": location, "description": description,
            "start": ["dateTime": "\(date)T\(start):00", "timeZone": "Europe/Prague"],
            "end": ["dateTime": "\(date)T\(end):00", "timeZone": "Europe/Prague"],
            "reminders": ["useDefault": false, "overrides": [Any]()],
            "extendedProperties": ["private": ["reisKind": "lesson", "reisHash": hash, "reisV": "1"]],
        ]
        return Desired(id: id, date: date, hash: hash, body: body)
    }
}
```

  The backslash sequences above are Swift escapes in source: `\u{2013}` is an en dash, `\u{1F}` the unit separator, `\(...)` interpolation.
- [ ] **Step 4: Run them to verify they pass.** Commit:

```bash
git add native/capacitor-google-calendar
git commit -m "feat(gcal/ios): Swift lesson mapper and planner, held to the shared fixtures"
```

### Task 17: The iOS background task

**Files:**
- Create: `native/capacitor-google-calendar/ios/Sources/GoogleCalendarPlugin/CalendarSyncTask.swift`, `IsTimetable.swift`, `CalendarHttp.swift`, `SecureStoreReader.swift`
- Modify: `ios/App/App/AppDelegate.swift` (`import ReisCapacitorGoogleCalendar` + `CalendarSyncTask.register()` in `didFinishLaunching`, per Task 2's finding)

**Design:**
- `BGTaskScheduler.shared.register(forTaskWithIdentifier: "cz.reis.app.calendar-sync", using: nil) { task in CalendarSyncTask.handle(task as! BGAppRefreshTask) }`.
- `schedule()` submits a `BGAppRefreshTaskRequest` with `earliestBeginDate = now + 6h`. Call it from `configure(enabled: true)` and at the end of every run.
- Set `expirationHandler` to cancel the URLSession tasks and `setTaskCompleted(success: false)`.
- **Steps:** the same as Android's 1–9, but:
  - the token comes from `GIDSignIn.sharedInstance.restorePreviousSignIn` → `refreshTokensIfNeeded`;
  - the IS token comes from the keychain, service `cz.reis.app.securestore`, account `reis.session.uisAuth`. That's a **read-only** `SecItemCopyMatching`; `native/capacitor-secure-store` stays untouched.
- Budget: ~30 s. Stop after the planner if fewer than 8 s remain, and leave the writes for the next run.

- [ ] **Step 1: Implement**, then install the release build on the cabled iPad.
- [ ] **Step 2: Fire the task from the Xcode debugger** (the Task 2 command):
  - delete one future lesson in Google → it comes back;
  - delete one past lesson → it doesn't;
  - read the steps in Console.app filtered by subsystem `cz.reis.app.gcal`.
- [ ] **Step 3: Commit**

```bash
git add native/capacitor-google-calendar ios/App/App/AppDelegate.swift
git commit -m "feat(gcal/ios): BGAppRefreshTask keeps future lessons in sync"
```

---

## Milestone 5: Release prerequisites and end-to-end

### Task 18: Google project to production and the policy pages

**Files:** in `../reis-page` (resolve it from a worktree as CLAUDE.md says): `soukromi/index.html`, `podminky/index.html`, linked from `index.html`. That's a separate PR on `reis-page` `main`, with no `test` branch there.

- [ ] **Step 1: The `reis-page` PR:**
  - a privacy page rendering the content of `docs/privacy-policy-app.md`;
  - a short terms page;
  - both name the app **reIS**, matching the consent screen exactly; brand checks flag mismatches.
  - Show Dominik the pages before merging.
- [ ] **Step 2: Domain verification.** Search Console → add `reis-navod.cz` as `reis.mendelu@gmail.com` (DNS TXT on Vercel's domain settings; Dominik may need to do the DNS click).
- [ ] **Step 3: Console, as `reis.mendelu` (`authuser=2`):**
  - **Data access:** save `calendar.app.created`, `calendar.calendarlist.readonly`, `email`. Confirm `email` is listed non-sensitive.
  - **Clients:** add an Android client for the Play App Signing SHA-1 (Play Console → Test and release → App integrity).
  - **Branding:**
    - name `reIS`; logo 120×120 PNG from `public/` (use an existing reIS icon);
    - homepage `https://reis-navod.cz`, privacy `https://reis-navod.cz/soukromi/`, terms `https://reis-navod.cz/podminky/`;
    - authorised domain `reis-navod.cz`, and **remove `chromiumapp.org`**;
    - Save → **Verify branding**.
- [ ] **Step 4: Publish:** Audience → Publish app → In production. Expect no review prompt (non-sensitive scopes). If a review is demanded, stop and report.
- [ ] **Step 5: Record the outcome in the spec's "Google project" section** and commit.

### Task 19: The end-to-end matrix, then the PR to `test`

- [ ] **Step 1: Two devices.** Pixel and iPad on `reis.mendelu`, both connected. Exactly one "Rozvrh" at calendar.google.com, the event count equals reIS, and a lesson edited by one device's sync isn't flipped back by the other: run the job on both and diff `updated` timestamps via the API.
- [ ] **Step 2: Language switch.** Switch the app to English: future titles change, past titles don't.
- [ ] **Step 3: Turn-off paths.** "Jen vypnout" keeps the calendar; "Vypnout a smazat" removes it; deleting "Rozvrh" in Google turns the row off with the `gone` text.
- [ ] **Step 4: Local checks:** `npx vitest run src/mobile/googleCalendar src/test/guards scripts/privacy` and `npm run typecheck`.
- [ ] **Step 5: Open the PR.** `gh pr create --base test` (push via the `personal` identity; memory `github-push-identity`), then turn on Auto-fix (memory `always-enable-auto-fix`).
  - PR body: link the spec and the plan, list the device evidence (PNG screenshots sent to Dominik), and note the store-form changes owed at release:
    - Play: Calendar events, collected, optional, App functionality;
    - Apple: Other User Content;
    - the gist re-publish via `npm run privacy:publish`.
  - What's new copy is agreed with Dominik per release; propose, don't decide.
