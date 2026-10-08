# Timetable → Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone/iPad student turns on one row in the profile sheet. From then on, reIS keeps a "Rozvrh" calendar in their own Google account up to date (lessons, exams and custom events) **whenever reIS is open**, with no reIS server involved. Background sync is phase 2 and not in this plan (spec, "Phase 2").

**Architecture:**
- **TypeScript does the whole sync, only while the app runs:**
  - pure modules: normalize, map, plan;
  - a small REST client over `fetch`;
  - a runner, triggered by a store subscription installed only from `capacitor/startApp.ts`.
- **Native code only signs in:** a small plugin per OS. Google's own SDKs hold the grant (`AuthorizationClient` on Android, GoogleSignIn-iOS on iOS); reIS code only ever asks them for a 1-hour access token.
- **Golden fixtures pin the mapping and the planner** (`__fixtures__/*.json`), so a change to them is deliberate.

**Tech stack:**
- TypeScript, Vitest, Zustand (store slice);
- Capacitor 8, Java (Android), `play-services-auth` 22.0.0;
- Swift and GoogleSignIn-iOS 10.x (iOS);
- Google Calendar API v3.

**Spec:** `docs/superpowers/specs/2026-10-08-google-calendar-sync-design.md`. It is approved, and it says *why* for everything below. Read it first.

## Global Constraints

- **Trees:**
  - Phone/iPad only. Nothing under `src/` that the extension imports may import `src/mobile/googleCalendar/**` or the native plugin. Install only from `capacitor/startApp.ts`.
  - The extension gets nothing; record that in `src/test/guards/desktopHasNoGoogleCalendar.test.ts`.
- **Scopes:** exactly `https://www.googleapis.com/auth/calendar.app.created`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly` and `email`. GoogleSignIn-iOS also always requests `openid` and `profile`, both non-sensitive sign-in scopes; that's acceptable and must be listed on the Data access page too (Task 18).
- **First fill is resumable:** the creating run persists `calendarId` plus `pastFillPending: true` immediately after `createCalendar`. Past events are included on every run until one completes with the flag set.
- **Granted scopes are checked** (granular consent, spec fact 10): `connect` returns the granted scopes. Without `calendar.app.created` the sync is not enabled (`notice: 'scopeMissing'`). Without `calendarlist.readonly`, `connect` asks once more, then proceeds either way.
- **No client secret, no Web client, no relay server.** Android uses an Android OAuth client (package + SHA-1); iOS uses an iOS OAuth client.
- **Google project:** `reis-479320`, owner `reis.mendelu@gmail.com`. Never mention any personal Google account in code, commits or docs.
- **Calendar:** name `Rozvrh`. Time zone `Europe/Prague`. The marker `reis:rozvrh:v1` goes in the calendar description.
- **Event id:** `kindPrefix + base32hex(sha256(stableKey))`. Prefixes `l` lesson, `e` exam, `c` custom. Alphabet `0123456789abcdefghijklmnopqrstuv`.
- **`extendedProperties.private`:** `reisKind` (`lesson|exam|custom`), `reisHash` (the first 16 hex characters of sha256 over the canonical fields), `reisV` = `"1"`.
- **Past events are written only by the device that *creates* the calendar.** Every other sync touches only events with date ≥ today (Europe/Prague).
- **Deletes require all of the following:**
  - the kind's source was confirmed this run (exams: `status === 'success' && data.length > 0`, where `data` is the subject list, which stays non-empty after deregistering);
  - **lessons only:** the desired list is non-empty, and deletes ≤ ⅓ of existing future lessons unless the previous run held back the same set. IS's failure-looks-like-empty problem is a timetable problem; a student deregistering from their last exam must disappear from Google.
- **409 on insert** → `PUT` the same id with `status: "confirmed"`.
- **No background work of any kind** in this plan: no JobService, no BGAppRefreshTask, no `UIBackgroundModes`, no native timetable fetch, no Java/Swift mapping ports. Nothing a student must enable in system settings.
- **Logging:** errors via `logError('GoogleCalendar.<step>', err)`. Never `console.error` directly.
- **Repo rules:** no `localStorage`; no `useEffect` data fetching; DaisyUI classes only; max ~200 lines per file; direct imports, no barrels; test first.
- **Local checks:** `npx vitest run <pattern>` and `npm run typecheck`. Repo-wide lint, format and full test runs are left to CI (CLAUDE.md).
- **Device tests:** signed **release** builds only (`npm run android:push`; the iPad via the `ipad-device` recipe). Sign in with a test-user account: `reis.mendelu@gmail.com`, or Dominik's own calendar account (added as a test user 2026-10-08, at his request; never name it in code, commits or docs).
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
| `src/mobile/googleCalendar/__fixtures__/lessonEvents.json` | golden lesson-mapping fixture |
| `src/mobile/googleCalendar/__fixtures__/lessonPlans.json` | golden planner fixture |
| `src/store/slices/createGoogleCalendarSlice.ts` | **state only** (status, lastSyncAt, progress, message), so the extension bundle stays clean |
| `src/components/mobile/sheets/GoogleCalendarSheet.tsx` | the sheet: connect, status, disconnect choices |
| `android/app/src/main/java/cz/reis/app/GoogleCalendarPlugin.java` | the Android plugin: sign-in and token only |
| `native/capacitor-google-calendar/**` | the iOS plugin: sign-in and token only |
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

### Task 2: iOS spike on the cabled iPad (throwaway) — done 2026-10-08

Results are in the spec, fact 10. Branch `spike/ios-gcal` (never merged; delete it after
Task 15 lands). The iOS client "reIS iOS" exists and is kept. Background refresh was not
measured because v1 dropped background sync. The Mac ("Designed for iPad") check moved to
Task 15, Step 3.

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
 * `src/services/sync/syncSchedule.ts` and `src/injector/dataFetchers.ts`.
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
 * Fixed strings, NOT i18n JSON: a translation tweak must not silently change
 * every event hash and rewrite every future event in Google.
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

### Task 4: Event identity, mapping and the golden lesson fixture

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
 * Golden output of the mapping. A change here changes every hash, so every
 * future event is rewritten once on each student's next sync. Make it on purpose.
 * Regenerate deliberately: UPDATE_GCAL_FIXTURES=1 npx vitest run lessonFixture
 */
const PATH = resolve(__dirname, '../__fixtures__/lessonEvents.json');

interface Case {
  name: string;
  lang: 'cz' | 'en';
  /** The MERGED lesson shape both paths produce: CZ base + EN name/room (mergeDualLanguageLessons). */
  lesson: { id: string; date: string; startTime: string; endTime: string; courseName: string; courseNameCs: string; courseNameEn: string; room: string; roomCs: string; roomEn: string; isSeminar: string; teachers: string[] };
  expected?: { id: string; hash: string; body: unknown };
}

const L = (o: Partial<Case['lesson']> & Pick<Case['lesson'], 'id' | 'courseName' | 'room'>): Case['lesson'] => ({
  date: '20261012', startTime: '09:00', endTime: '10:50', isSeminar: 'false', teachers: [],
  courseNameCs: o.courseName, courseNameEn: o.courseName, roomCs: o.room, roomEn: o.room, ...o,
});
const INPUTS: Omit<Case, 'expected'>[] = [
  { name: 'cz lecture', lang: 'cz', lesson: L({ id: '123', courseName: 'Ekonomie I', room: 'Q01', teachers: ['doc. Jan Novák'] }) },
  { name: 'en seminar, EN name and room differ, two teachers', lang: 'en', lesson: L({ id: '124', date: '20261013', startTime: '13:00', endTime: '14:50', courseName: 'Ekonomie I', courseNameEn: 'Economics I', room: 'Q02', roomEn: 'Q02 (EN)', isSeminar: 'true', teachers: ['A B', 'C D'] }) },
  { name: 'no teacher, no room, diacritics', lang: 'cz', lesson: L({ id: '9', date: '20270301', startTime: '07:00', endTime: '08:50', courseName: 'Účetnictví – úvod', room: '' }) },
];

const toBlock = (l: Case['lesson']): BlockLesson =>
  ({ ...l, teachers: l.teachers.map((fullName, i) => ({ fullName, shortName: fullName, id: String(i) })) }) as unknown as BlockLesson;

async function compute(c: Omit<Case, 'expected'>): Promise<Case> {
  const [n] = normalizeLessons([toBlock(c.lesson)], c.lang);
  const d = await toDesired(n!);
  return { ...c, expected: { id: d.id, hash: d.hash, body: d.body } };
}

describe('golden lesson fixture', () => {
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
git commit -m "feat(gcal): deterministic event ids, content hash and the golden lesson fixture"
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

- [ ] **Step 1: Write the failing test**, driven by the golden fixture.

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
    "name": "deregistering the last exam deletes it",
    "input": {
      "kind": "exam", "today": "2026-10-08", "includePast": false, "sourceConfirmed": true, "previousHeld": null,
      "desired": [],
      "existing": [{ "id": "e1", "date": "2027-01-20", "hash": "x" }]
    },
    "expected": { "insert": [], "update": [], "remove": ["e1"], "held": null }
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
- In the last two cases the one-in-one deletion would exceed ⅓, but the empty rule and the ⅓ rule apply to lessons only.

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

describe('planKind (golden fixture)', () => {
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
 * One kind, one run. Pure: same input, same plan (lessonPlans.json pins it).
 *
 * Deletes are the dangerous half. Every kind needs a confirmed read. Lessons
 * also need a non-empty desired list and, past a third of the future, the
 * same set seen twice in a row: IS answers "no lessons" and "query failed"
 * with the same bytes. Exams and custom events may legitimately go empty.
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
  // Lessons only: IS answers "no lessons" and "failed" with the same bytes.
  // Exams and custom events legitimately go empty (last exam deregistered).
  if (kind === 'lesson' && input.desired.length === 0) return empty;

  const fingerprint = deleteFingerprint(candidates);
  const massive = kind === 'lesson' && candidates.length * 3 > futureExisting.length;
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

**Note on batching (deliberate deviation from the spec, verified 2026-10-08):**
- Google's batch guide: "A set of n requests batched together counts toward your usage limit as n requests".
- The `reis-479320` console shows **600 queries per minute per user** (10,000 per minute per project).
- So batching saves only HTTP overhead. Writes are **paced at 5 requests/second** (300/min): about 100 s for a ~500-event first fill, with progress shown, and resumable (Task 7).
- Task 6 Step 6 updates the spec's "Transport" paragraph to match.

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
  it('treats an unticked calendar list (403 insufficient scopes) as not found', async () => {
    const { a } = api([{ status: 403, body: { error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'insufficientPermissions' }] } } }]);
    expect(await a.findReisCalendar()).toBeNull();
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
        const res = await request('GET', q);
        // Granular consent: the student unticked the calendar list. Not a rate limit
        // (those say rateLimitExceeded and are retried inside request), so create instead.
        if (res.status === 403 && /insufficient/i.test(await res.clone().text())) return null;
        const json = (await (await ok(res, 'calendarList')).json()) as {
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
  pastFillPending: boolean; // the creating run hasn't finished writing history yet
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
  persist: (s: SyncState) => Promise<void>; // called right after createCalendar
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
    const r = await runSync({ api, now: NOW, persist: async () => {}, state: { calendarId: null, held: {}, lastSyncAt: null, pastFillPending: false }, sources: sources(['2026-10-01', '2026-10-09']) });
    expect(r).toMatchObject({ kind: 'ok', written: 2, state: { calendarId: 'new-cal' } });
    expect(log.filter((l) => l.startsWith('up:'))).toHaveLength(2);
  });
  it('reusing an existing calendar never writes the past', async () => {
    const { api, log } = fakeApi({ found: 'theirs' });
    await runSync({ api, now: NOW, persist: async () => {}, state: { calendarId: null, held: {}, lastSyncAt: null, pastFillPending: false }, sources: sources(['2026-10-01', '2026-10-09']) });
    expect(log).not.toContain('create');
    expect(log.filter((l) => l.startsWith('up:'))).toHaveLength(1);
  });
  it('reports calendarGone when Rozvrh was deleted', async () => {
    const { api } = fakeApi({ gone: true });
    const r = await runSync({ api, now: NOW, persist: async () => {}, state: { calendarId: 'cal', held: {}, lastSyncAt: 1, pastFillPending: false }, sources: sources(['2026-10-09']) });
    expect(r).toEqual({ kind: 'calendarGone' });
  });
  it('an interrupted creating run resumes the past fill', async () => {
    const { api, log } = fakeApi();
    const saved: unknown[] = [];
    const realUpsert = api.upsert;
    let n = 0;
    api.upsert = async (c, d) => { if (++n === 2) throw new Error('app killed'); return realUpsert(c, d); };
    await expect(runSync({ api, now: NOW, persist: async (s) => void saved.push(s),
      state: { calendarId: null, held: {}, lastSyncAt: null, pastFillPending: false },
      sources: sources(['2026-10-01', '2026-10-02', '2026-10-09']) })).rejects.toThrow('app killed');
    expect(saved.at(-1)).toMatchObject({ calendarId: 'new-cal', pastFillPending: true });
    api.upsert = realUpsert;
    const r = await runSync({ api, now: NOW, persist: async () => {},
      state: saved.at(-1) as never, sources: sources(['2026-10-01', '2026-10-02', '2026-10-09']) });
    expect(r).toMatchObject({ kind: 'ok', state: { pastFillPending: false } });
    expect(log.filter((l) => l.startsWith('up:'))).toHaveLength(3);
  });
  it('a second run with nothing changed writes nothing', async () => {
    const { api, log } = fakeApi();
    const first = await runSync({ api, now: NOW, persist: async () => {}, state: { calendarId: null, held: {}, lastSyncAt: null, pastFillPending: false }, sources: sources(['2026-10-09']) });
    log.length = 0;
    if (first.kind !== 'ok') throw new Error('first run failed');
    await runSync({ api, now: NOW, persist: async () => {}, state: first.state, sources: sources(['2026-10-09']) });
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
  pastFillPending: boolean;
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
  persist: (s: SyncState) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}): Promise<SyncOutcome> {
  const { api, sources, now } = o;
  const today = pragueToday(now);
  try {
    let calendarId = o.state.calendarId;
    // Only the creating device writes history, and it keeps trying until a run
    // finishes: a ~500-event first fill takes minutes, and phones get killed.
    let includePast = o.state.pastFillPending;
    if (!calendarId) {
      calendarId = await api.findReisCalendar();
      if (!calendarId) {
        calendarId = await api.createCalendar(CALENDAR_NAME);
        includePast = true;
        await o.persist({ ...o.state, calendarId, pastFillPending: true });
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
    return { kind: 'ok', written: work.length, state: { calendarId, held, lastSyncAt: now.getTime(), pastFillPending: false } };
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
  isAvailable(): Promise<{ available: boolean }>; // Play Services present / not Mac-on-iPad (per Task 15)
  connect(): Promise<{ email: string | null; scopes: string[] }>; // consent UI; asks only for what's missing
  accessToken(): Promise<{ token: string }>; // silent; rejects 'REVOKED' when no grant
  invalidateToken(o: { token: string }): Promise<void>;
  disconnect(): Promise<void>; // revoke at Google + forget locally
  status(): Promise<{ connected: boolean; email: string | null }>;
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
    notice: 'calendarGone' | 'revoked' | 'failed' | 'scopeMissing' | null;
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
    expect(await loadSyncState()).toEqual({ enabled: false, calendarId: null, held: {}, lastSyncAt: null, pastFillPending: false, sourcesFingerprint: null });
  });
  it('round-trips and clears', async () => {
    const s = { enabled: true, calendarId: 'c', held: { lesson: 'l1' }, lastSyncAt: 5, pastFillPending: false, sourcesFingerprint: 'f' };
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
    notice: 'calendarGone' | 'revoked' | 'failed' | 'scopeMissing' | null;
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
  connect(): Promise<{ email: string | null; scopes: string[] }>;
  accessToken(): Promise<{ token: string }>;
  invalidateToken(o: { token: string }): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<{ connected: boolean; email: string | null }>;
}

export const SCOPE_APP_CREATED = 'https://www.googleapis.com/auth/calendar.app.created';
export const SCOPE_CALENDAR_LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';

export const GoogleCalendarNative = registerPlugin<GoogleCalendarNativePlugin>('GoogleCalendar');
```

`src/mobile/googleCalendar/syncStateStore.ts`:

```ts
import { getPlatform } from '../../platform';
import type { SyncState } from './runSync';

const KEY = 'reis.gcal.state';
export type PersistedSync = SyncState & { enabled: boolean; sourcesFingerprint: string | null };
const EMPTY: PersistedSync = { enabled: false, calendarId: null, held: {}, lastSyncAt: null, pastFillPending: false, sourcesFingerprint: null };

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
- Consumes: `runSync`, `createCalendarApi`, `GoogleCalendarNative` (+ the two scope constants), `loadSyncState`/`saveSyncState`, `useAppStore` (`schedule`, `exams`, `customEvents`, `language`, `gcal`, `setGcal`), `isDemoMode` (`src/errors/demoMode.ts`)
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
  3. `useAppStore.subscribe` on `schedule.data`, `exams.data`, `customEvents` and `language`, debounced 3 s → `syncGoogleCalendarNow('change')`. Opening the app loads the schedule, so this is also the on-open trigger.
- **`syncGoogleCalendarNow`:**
  1. Return early unless enabled, not demo mode, and the store's schedule status ≠ `loading`.
  2. Return if a sync is already running (a module-level `running` flag; one JS process, no native job to race).
  3. Compute `sourcesFingerprint`; on `'change'`, return if it equals the stored one **and** the last sync is under 6 h old. The 6 h re-run repairs edits made in Google (a deleted future lesson comes back) without a background job.
  4. `setGcal({ syncing: true })` → `runSync` → handle the outcome; clear `running` in `finally`.
- **`connectGoogleCalendar`:** `connect()`; if `scopes` lacks `SCOPE_APP_CREATED` → `setGcal({ notice: 'scopeMissing' })` and stop. If it lacks only `SCOPE_CALENDAR_LIST` → call `connect()` once more, then proceed whatever it returns (`findReisCalendar` treats a 403 as "not found").
- **Confirmation flags:**
  - `lessonsConfirmed = schedule.status === 'success' && schedule.data.length > 0`;
  - `examsConfirmed = exams.status === 'success' && exams.data.length > 0` (subjects, not registrations).
- **A held-back delete:** don't store `sourcesFingerprint` (store `null`), so the next trigger re-runs and can confirm it.
- **Outcomes:**
  - `calendarGone`: `clearSyncState`, `setGcal({ connected: false, notice: 'calendarGone' })`. The calendar is not recreated.
  - `revoked`: the same, with `notice: 'revoked'`.
  - Thrown error: `logError('GoogleCalendar.sync', e)` and `setGcal({ notice: 'failed' })`. Keep the state; the next trigger retries.
- **`disconnectGoogleCalendar({ deleteCalendar })`:**
  - If `deleteCalendar` and the state has a `calendarId`: `DELETE /calendars/{id}` via the API. The `remove` helper deletes events, so add `deleteCalendar(id)` to `calendarApi` with a test: `DELETE /calendars/{id}`, 404/410 = ok.
  - Then `GoogleCalendarNative.disconnect()`, `clearSyncState()`, `setGcal({ connected: false, email: null })`.

- [ ] **Step 1: Write the failing controller tests**, mocking `GoogleCalendarNative` with `vi.mock('../googleCalendarNative', ...)`. See the vitest-5 mock traps memory: mock at top level, never nested.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = {
  isAvailable: vi.fn(async () => ({ available: true })),
  connect: vi.fn(async () => ({ email: 'reis.mendelu@gmail.com', scopes: [APP, LIST] })),
  accessToken: vi.fn(async () => ({ token: 'T' })),
  invalidateToken: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  status: vi.fn(async () => ({ connected: true, email: 'reis.mendelu@gmail.com' })),
};
const APP = 'https://www.googleapis.com/auth/calendar.app.created';
const LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
vi.mock('../googleCalendarNative', () => ({ GoogleCalendarNative: native, SCOPE_APP_CREATED: APP, SCOPE_CALENDAR_LIST: LIST }));
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
  it('connect enables and runs a sync', async () => {
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 1, state: { calendarId: 'c', held: {}, lastSyncAt: 1, pastFillPending: false } });
    await connectGoogleCalendar();
    expect((await loadSyncState()).enabled).toBe(true);
    expect(runSyncMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().gcal.connected).toBe(true);
  });
  it('connect without calendar.app.created does not enable', async () => {
    native.connect.mockResolvedValueOnce({ email: 'x@y', scopes: [LIST] });
    await connectGoogleCalendar();
    expect((await loadSyncState()).enabled).toBe(false);
    expect(runSyncMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().gcal.notice).toBe('scopeMissing');
  });
  it('connect without the calendar list asks once more, then proceeds', async () => {
    native.connect.mockResolvedValueOnce({ email: 'x@y', scopes: [APP] }).mockResolvedValueOnce({ email: 'x@y', scopes: [APP] });
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 1, state: { calendarId: 'c', held: {}, lastSyncAt: 1, pastFillPending: false } });
    await connectGoogleCalendar();
    expect(native.connect).toHaveBeenCalledTimes(2);
    expect((await loadSyncState()).enabled).toBe(true);
  });
  it('change with an unchanged fingerprint and a fresh sync does nothing', async () => {
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 0, state: { calendarId: 'c', held: {}, lastSyncAt: Date.now(), pastFillPending: false } });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).not.toHaveBeenCalled();
  });
  it('a held-back delete re-runs on the next change even with unchanged sources', async () => {
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 0, state: { calendarId: 'c', held: { lesson: 'l2,l3' }, lastSyncAt: 1, pastFillPending: false } });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });
  it('calendarGone turns the sync off and does not recreate', async () => {
    await saveSyncState({ enabled: true, calendarId: 'c', held: {}, lastSyncAt: 1, pastFillPending: false, sourcesFingerprint: null });
    runSyncMock.mockResolvedValue({ kind: 'calendarGone' });
    await syncGoogleCalendarNow('change');
    expect((await loadSyncState()).enabled).toBe(false);
    expect(useAppStore.getState().gcal.notice).toBe('calendarGone');
  });
  it('unchanged sources still re-run after 6 h, to repair edits made in Google', async () => {
    runSyncMock.mockResolvedValue({ kind: 'ok', written: 0, state: { calendarId: 'c', held: {}, lastSyncAt: Date.now() - 7 * 3600_000, pastFillPending: false } });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });
  it('a second trigger while a sync runs is dropped', async () => {
    await saveSyncState({ enabled: true, calendarId: 'c', held: {}, lastSyncAt: 1, pastFillPending: false, sourcesFingerprint: null });
    let release!: () => void;
    runSyncMock.mockImplementationOnce(() => new Promise((r) => (release = () => r({ kind: 'ok', written: 0, state: { calendarId: 'c', held: {}, lastSyncAt: 1, pastFillPending: false } }))));
    const first = syncGoogleCalendarNow('change');
    await syncGoogleCalendarNow('change');
    release();
    await first;
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run controller`
- [ ] **Step 3: Implement `controller.ts`** (keep it under ~200 lines; if it grows, split the outcome handling into `outcome.ts`):

```ts
import { GoogleCalendarNative, SCOPE_APP_CREATED, SCOPE_CALENDAR_LIST } from './googleCalendarNative';
import { createCalendarApi } from './calendarApi';
import { runSync, type SyncSources } from './runSync';
import { clearSyncState, loadSyncState, saveSyncState } from './syncStateStore';
import { sha256Hex } from './eventIdentity';
import { useAppStore } from '../../store/useAppStore';
import { isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';

/** Unchanged sources still re-sync after this, to repair edits made in Google. */
const REPAIR_AFTER_MS = 6 * 3600_000;
let cachedToken: string | null = null;
let running = false;

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
    examsConfirmed: s.exams.status === 'success' && s.exams.data.length > 0,
    custom: s.customEvents,
  };
}

export async function sourcesFingerprint(src: SyncSources): Promise<string> {
  return sha256Hex(JSON.stringify([src.language, src.lessons, src.exams, src.custom]));
}

async function turnOff(notice: 'calendarGone' | 'revoked' | null) {
  await clearSyncState();
  useAppStore.getState().setGcal({ connected: false, email: null, syncing: false, progress: null, notice });
}

export async function syncGoogleCalendarNow(reason: 'connect' | 'change'): Promise<void> {
  const st = await loadSyncState();
  if (!st.enabled || isDemoMode() || running) return;
  const sources = currentSources();
  const fp = await sourcesFingerprint(sources);
  const fresh = st.lastSyncAt !== null && Date.now() - st.lastSyncAt < REPAIR_AFTER_MS;
  if (reason === 'change' && fp === st.sourcesFingerprint && fresh) return;
  running = true;
  const set = useAppStore.getState().setGcal;
  set({ syncing: true, notice: null });
  try {
    const out = await runSync({
      api: api(),
      state: st,
      sources,
      now: new Date(),
      persist: (s) => saveSyncState({ ...s, enabled: true, sourcesFingerprint: null }),
      onProgress: (done, total) => set({ progress: total > 20 ? { done, total } : null }),
    });
    if (out.kind === 'calendarGone' || out.kind === 'revoked') return await turnOff(out.kind);
    // A held-back delete needs a confirming second run, so don't let the
    // unchanged-sources shortcut skip it.
    const heldAny = Object.keys(out.state.held).length > 0;
    await saveSyncState({ ...out.state, enabled: true, sourcesFingerprint: heldAny ? null : fp });
    set({ lastSyncAt: out.state.lastSyncAt });
  } catch (e) {
    logError('GoogleCalendar.sync', e, { reason });
    set({ notice: 'failed' });
  } finally {
    set({ syncing: false, progress: null });
    running = false;
  }
}

export async function connectGoogleCalendar(): Promise<void> {
  try {
    let { email, scopes } = await GoogleCalendarNative.connect();
    if (!scopes.includes(SCOPE_APP_CREATED)) {
      useAppStore.getState().setGcal({ notice: 'scopeMissing' });
      return;
    }
    // Granular consent: the calendar list was unticked. Ask once more; it only
    // helps a second device find the same "Rozvrh", so proceed either way.
    if (!scopes.includes(SCOPE_CALENDAR_LIST)) ({ email, scopes } = await GoogleCalendarNative.connect());
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
      useAppStore.getState().setGcal({
        available,
        connected: connected && st.enabled,
        email,
        lastSyncAt: st.lastSyncAt,
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
| `explain` | reIS vytvoří ve tvém Googlu kalendář „Rozvrh" a aktualizuje ho pokaždé, když reIS otevřeš. Ostatní kalendáře nevidí ani nemění. | reIS creates a "Rozvrh" calendar in your Google account and updates it every time you open reIS. It cannot see or change your other calendars. |
| `account` | Účet: {{email}} | Account: {{email}} |
| `open` | Otevřít v Google Kalendáři | Open in Google Calendar |
| `progress` | Synchronizuji {{done}}/{{total}} | Syncing {{done}}/{{total}} |
| `offDelete` | Vypnout a smazat kalendář Rozvrh | Turn off and delete the Rozvrh calendar |
| `offKeep` | Jen vypnout | Turn off only |
| `revoked` | Přístup ke Google Kalendáři byl odebrán. | Access to Google Calendar was removed. |
| `gone` | Kalendář Rozvrh byl v Googlu smazán, synchronizace je vypnutá. | The Rozvrh calendar was deleted in Google, so sync is off. |
| `failed` | Synchronizace se nepovedla, zkusím to znovu. | Sync failed. I'll try again. |
| `scopeMissing` | Google nedal reIS přístup ke kalendáři. Zkus to znovu a nech políčka zaškrtnutá. | Google didn't give reIS access to the calendar. Try again and leave the boxes ticked. |

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

const NOTICE_KEY = { revoked: 'mobile.gcal.revoked', calendarGone: 'mobile.gcal.gone', failed: 'mobile.gcal.failed', scopeMissing: 'mobile.gcal.scopeMissing' } as const;

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

  /**
   * Named so the tree-parity Stop hook (.claude/hooks/tree-parity.mjs) clears
   * them: these files are phone/iPad-only by decision, not by omission.
   */
  it.each([
    'src/mobile/googleCalendar/calendarApi.ts',
    'src/mobile/googleCalendar/controller.ts',
    'src/mobile/googleCalendar/eventIdentity.ts',
    'src/mobile/googleCalendar/googleCalendarNative.ts',
    'src/mobile/googleCalendar/installGoogleCalendarSync.ts',
    'src/mobile/googleCalendar/normalize.ts',
    'src/mobile/googleCalendar/plan.ts',
    'src/mobile/googleCalendar/pragueDate.ts',
    'src/mobile/googleCalendar/runSync.ts',
    'src/mobile/googleCalendar/syncStateStore.ts',
    'src/mobile/googleCalendar/toGoogleEvent.ts',
    'src/mobile/googleCalendar/types.ts',
    'src/components/mobile/sheets/GoogleCalendarSheet.tsx',
  ])('%s is phone-only', (file) => {
    expect(() => read(file)).not.toThrow();
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
  when: 'background', // automatic after one opt-in (runs while the app is open), not per action
  identifier: 'none',
  files: ['src/mobile/googleCalendar/calendarApi.ts'],
  calls: [],
  policyRows: [
    [
      'Google Calendar sync',
      'only if you turn it on, then whenever you open reIS and your timetable changed',
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

## Milestone 3: Android native (sign-in only)

### Task 12: `GoogleCalendarPlugin.java`

**Files:**
- Create: `android/app/src/main/java/cz/reis/app/GoogleCalendarPlugin.java`
- Modify: `android/app/build.gradle` (`implementation 'com.google.android.gms:play-services-auth:22.0.0'`), `android/app/src/main/java/cz/reis/app/MainActivity.java` (`registerPlugin(GoogleCalendarPlugin.class);`)

**Interfaces:** implements every method of `GoogleCalendarNativePlugin` (Task 8). The only thing it stores is the connected account's email, in SharedPreferences `reis_gcal` (needed for `revokeAccess` and `status`).

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
  static final String PREFS = "reis_gcal";
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
      getContext().getSharedPreferences(PREFS, 0).edit().putString("email", email).apply();
      JSArray scopes = new JSArray();
      for (String sc : res.getGrantedScopes()) scopes.put(sc); // granular consent: may lack some
      call.resolve(new JSObject().put("email", email).put("scopes", scopes));
    }).start();
  }

  @PluginMethod public void accessToken(PluginCall call) {
    Identity.getAuthorizationClient(getContext()).authorize(request())
      .addOnSuccessListener(res -> {
        // hasResolution = consent needed again, i.e. a scope was revoked or never granted.
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
    String email = getContext().getSharedPreferences(PREFS, 0).getString("email", null);
    Runnable forget = () -> {
      getContext().getSharedPreferences(PREFS, 0).edit().clear().apply();
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

  /** Connected = a stored email and a silent authorize() that needs no consent. */
  @PluginMethod public void status(PluginCall call) {
    String email = getContext().getSharedPreferences(PREFS, 0).getString("email", null);
    if (email == null) { call.resolve(new JSObject().put("connected", false).put("email", null)); return; }
    Identity.getAuthorizationClient(getContext()).authorize(request())
      .addOnSuccessListener(res -> call.resolve(new JSObject()
          .put("connected", !res.hasResolution() && res.getAccessToken() != null).put("email", email)))
      .addOnFailureListener(e -> call.resolve(new JSObject().put("connected", false).put("email", email)));
  }
}
```

`connect` with only the missing scopes: `authorize()` with the full list already shows only what isn't granted yet, so the controller's second `connect()` needs no special code.

- [ ] **Step 2: Confirm the 22.0.0 API compiles as written:** `ClearTokenRequest`, `RevokeAccessRequest`, `AuthorizationClient.revokeAccess`. If `revokeAccess` is absent in this version, `disconnect` falls back to `clearToken` plus forgetting locally. Record that in the PR (the student can still revoke at myaccount.google.com).
- [ ] **Step 3: Check the merged manifest** (privacy check, spec point 4): `npm run android:apk`, then `~/Library/Android/sdk/cmdline-tools/latest/bin/apkanalyzer manifest permissions android/app/build/outputs/apk/release/app-release.apk`. If anything beyond the current `PLATFORM_PERMISSIONS.android` appears (e.g. `ACCESS_NETWORK_STATE`), add it to `privacy/disclosures.ts` and re-run `npx vitest run privacyDisclosures`.
- [ ] **Step 4: Device check on the Pixel**, signed in as `reis.mendelu`: install with `npm run android:push`, open Profil → Google Kalendář → Synchronizovat. Expect the account picker and consent screen, then "Rozvrh" appears at calendar.google.com, filled by the TS runner. Count: `adb logcat` has no `GoogleCalendar.*` errors, and the event count for this week matches reIS.
- [ ] **Step 5: Commit**

```bash
git add android/app
git commit -m "feat(gcal/android): GoogleCalendar plugin — consent, granted scopes, silent token"
```

### Tasks 13 and 14: removed 2026-10-08

The Java ports and the Android `JobService` were background sync, which moved to phase 2
(spec, "Phase 2"). Task numbers are kept so references elsewhere stay valid.

## Milestone 4: iOS native (sign-in only)

### Task 15: `native/capacitor-google-calendar`

**Files:**
- Create: `native/capacitor-google-calendar/package.json`, `Package.swift`, `ios/Sources/GoogleCalendarPlugin/GoogleCalendarPlugin.swift`
- Modify: root `package.json` (`"@reis/capacitor-google-calendar": "file:native/capacitor-google-calendar"`), `ios/App/App/Info.plist` (`GIDClientID` = `576873601004-j691e9hrs51grv8kj5g1p19mj0dcacfp.apps.googleusercontent.com`, URL scheme = `com.googleusercontent.apps.576873601004-j691e9hrs51grv8kj5g1p19mj0dcacfp`, `CFBundleName` = `reIS` so the system prompt stops saying "App"), `src/test/guards/nativePluginsAreReachable.test.ts` (if it lists plugins)
- Start from the spike branch `spike/ios-gcal`: `git show spike/ios-gcal:native/capacitor-google-calendar/Package.swift` (proven to build). The spike's URL handling observes `.capacitorOpenURL` inside the plugin, so `SceneDelegate.swift` needs no edit.

**Pattern:** copy `native/capacitor-eduroam`'s `package.json` and `Package.swift` shape **exactly**. The package/product name is derived from the npm name: `@reis/capacitor-google-calendar` → `ReisCapacitorGoogleCalendar`, target `GoogleCalendarPlugin`. Add the dependency `.package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "10.0.0")` with the product `GoogleSignIn`.

- [ ] **Step 1: Implement the plugin methods** (`@objc(GoogleCalendarPlugin)`, `jsName = "GoogleCalendar"`):
  - `isAvailable`: `!ProcessInfo.processInfo.isiOSAppOnMac`, or `true` if Task 2 proved the Mac works.
  - `connect`: if `currentUser` exists (after `restorePreviousSignIn`), `currentUser.addScopes(missing, presenting:)` for whichever of the two scopes it lacks; otherwise `GIDSignIn.sharedInstance.signIn(withPresenting: bridge.viewController, hint: nil, additionalScopes: [calendar.app.created, calendar.calendarlist.readonly])`. GoogleSignIn adds `email`/`profile`/`openid` itself, which covers the email scope. Resolve with `{ email: user.profile?.email, scopes: user.grantedScopes ?? [] }`.
  - `accessToken`: `restorePreviousSignIn` if `currentUser` is nil → `currentUser.refreshTokensIfNeeded` → `{ token }`; reject `REVOKED` if there's no user or the scopes are missing.
  - `invalidateToken`: no-op. GoogleSignIn refreshes on expiry; a 401 retry calls `refreshTokensIfNeeded` again.
  - `disconnect`: `GIDSignIn.sharedInstance.disconnect`.
  - `status`: `restorePreviousSignIn` → `{ connected: user != nil && grantedScopes contains calendar.app.created, email }`.
- [ ] **Step 2: Build, sync, install a release build on the cabled iPad** (`ipad-device` memory: `DEVELOPMENT_TEAM=RG38V3SV8X`, release configuration), connect, and check that "Rozvrh" fills at calendar.google.com. Untick the calendar-list box once and confirm reIS asks again for just that.
- [ ] **Step 3: The Mac ("Designed for iPad")**: ask Dominik to run the build from Xcode on "My Mac" and tap connect. If sign-in fails there, `isAvailable` returns `!ProcessInfo.processInfo.isiOSAppOnMac`. Record the result in the spec (fact 10).
- [ ] **Step 4: Run `npx vitest run nativePluginsAreReachable privacyDisclosures`**: the Info.plist got no new `NS*UsageDescription`, so `PLATFORM_PERMISSIONS.ios` is unchanged.
- [ ] **Step 5: Commit**, then delete the spike branch (`git branch -D spike/ios-gcal`).

```bash
git add native/capacitor-google-calendar package.json package-lock.json ios/App/App
git commit -m "feat(gcal/ios): GoogleCalendar plugin — GoogleSignIn consent, granted scopes, silent token"
```

### Tasks 16 and 17: removed 2026-10-08

The Swift ports and the `BGAppRefreshTask` were background sync, now phase 2 (spec,
"Phase 2"). Task numbers are kept.

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
  - **Data access:** save `calendar.app.created`, `calendar.calendarlist.readonly`, `email`, `openid` and `profile` (GoogleSignIn-iOS always asks for the last two). Confirm all of them are listed non-sensitive.
  - **Clients:** add an Android client for the Play App Signing SHA-1 (Play Console → Test and release → App integrity).
  - **Branding:**
    - name `reIS`; logo 120×120 PNG from `public/` (use an existing reIS icon);
    - homepage `https://reis-navod.cz`, privacy `https://reis-navod.cz/soukromi/`, terms `https://reis-navod.cz/podminky/`;
    - authorised domain `reis-navod.cz`, and **remove `chromiumapp.org`**;
    - Save → **Verify branding**.
- [ ] **Step 4: Publish:** Audience → Publish app → In production. Expect no review prompt (non-sensitive scopes). If a review is demanded, stop and report.
- [ ] **Step 5: Record the outcome in the spec's "Google project" section** and commit.

### Task 19: The end-to-end matrix, then the PR to `test`

- [ ] **Step 1: Two devices.** Pixel and iPad on `reis.mendelu`, both connected. Exactly one "Rozvrh" at calendar.google.com, the event count equals reIS, and a lesson synced by one device isn't rewritten by the other: open reIS on both and diff `updated` timestamps via the API (expect no change from the second device).
- [ ] **Step 2: Language switch.** Switch the app to English: future titles change, past titles don't.
- [ ] **Step 3: Turn-off paths.** "Jen vypnout" keeps the calendar; "Vypnout a smazat" removes it; deleting "Rozvrh" in Google turns the row off with the `gone` text.
- [ ] **Step 4: Local checks:** `npx vitest run src/mobile/googleCalendar src/test/guards scripts/privacy` and `npm run typecheck`.
- [ ] **Step 5: Open the PR.** `gh pr create --base test` (push via the `personal` identity; memory `github-push-identity`), then turn on Auto-fix (memory `always-enable-auto-fix`).
  - PR body: link the spec and the plan, list the device evidence (PNG screenshots sent to Dominik), and note the store-form changes owed at release:
    - Play: Calendar events, collected, optional, App functionality;
    - Apple: Other User Content;
    - the gist re-publish via `npm run privacy:publish`.
  - What's new copy is agreed with Dominik per release; propose, don't decide.
