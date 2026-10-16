import { IndexedDBService } from '../services/storage';
import { STORAGE_KEYS } from '../services/storage/keys';
import { fetchUserBaseIds, fetchUserStudyDetails, fetchUserNetId } from './userParams/fetchers';
import { logError } from './reportError';
import { announceIdentityChange } from './userParams/identityEvents';
import { resolveStudies, type ResolvedStudies } from './userParams/resolveStudies';
import { withStudy, type StudyOption } from './userParams/studies';

export interface UserParams {
  studium: string;
  obdobi: string;
  facultyId: string;
  username: string;
  email?: string;
  studentId: string;
  fullName: string;
  studyCode?: string;
  facultyLabel?: string;
  studyProgram?: string;
  studyForm?: string;
  studySemester?: number;
  studyYear?: number;
  periodLabel?: string;
  isErasmus: boolean;
  /**
   * The ACTIVE studies a multi-study student can switch between, IS order.
   * Absent for a single-study student — IS shows them no study select.
   */
  studies?: StudyOption[];
  /** Which study select the studies were last resolved for, and when. */
  studiesResolvedFor?: string;
  studiesResolvedAt?: number;
}

// In-memory cache — avoids redundant IDB reads across 20+ call sites per session.
let _cached: UserParams | null = null;
let _inflight: Promise<UserParams | null> | null = null;

/**
 * Whether IS has told THIS context, in this page session, who is signed in.
 *
 * Deliberately not persisted: it is a statement about the live session, and a
 * stored "already checked" would be exactly the assumption that broke.
 */
let _identityChecked = false;

/** When this context last asked IS who is signed in, confirmed or not. */
let _lastIdentityAttempt = 0;

/**
 * IS named a different student and the wipe of the previous one's data FAILED,
 * so their record is still on disk. Nothing is served for the rest of the
 * session: with `_identityChecked` already true, the next read would otherwise
 * take that record as confirmed and hand the new student the old `studium`.
 * Only a sign-out lifts it (`clearUserParamsCache`), and it is about to retry
 * the wipe; otherwise the next boot does.
 */
let _wrongStudentOnDisk = false;

/**
 * The study pages failed this session, so the study in use is unconfirmed.
 * Served like an unconfirmed identity — re-asked after the recheck gap —
 * rather than pinned for the session: the correcting start is exactly the
 * one where a page failing would otherwise keep the interrupted study.
 */
let _studiesPending = false;

/** The next resolution ignores the daily cache — the switcher's retry. */
let _forceResolve = false;

/** The fields a record holds for its study, as opposed to its student. */
const STUDY_FIELDS = [
  'studium',
  'obdobi',
  'studyCode',
  'facultyLabel',
  'studyProgram',
  'studyForm',
  'studySemester',
  'studyYear',
  'periodLabel',
  'isErasmus',
  'studies',
  'studiesResolvedFor',
  'studiesResolvedAt',
] as const;

function studyFieldsOf(p: Partial<UserParams>): Partial<UserParams> {
  return Object.fromEntries(
    STUDY_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])
  ) as Partial<UserParams>;
}

/**
 * How long a resolved study select is trusted. Every IS page load is a new
 * content script and a new app, and resolving costs a request per study;
 * a study is interrupted or ended rarely, and a changed select (a study
 * added or dropped) is resolved at once.
 */
const STUDIES_RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * How long an UNCONFIRMED record is served before the check is tried again.
 *
 * The first attempt can fail for reasons that pass: the laptop is offline, IS
 * is slow, or — in the iframe — the fetch proxy's first request raced the
 * content script coming up. Caching the stale record forever on one failure
 * would freeze the wrong student in place for the whole session, and retrying
 * on every call would put ~20 requests at a server that is already not
 * answering. One attempt a minute is neither.
 */
const IDENTITY_RECHECK_GAP_MS = 60_000;

/**
 * `studium`/`obdobi` alone are not a complete record. They are the two fields
 * that carry no words, so they survived an English `studium.pl` that left
 * `studentId` and `fullName` empty — and the early return then served that
 * half-record forever, outliving the parser bug that wrote it and leaving the
 * student's own photo permanently unreachable.
 */
const complete = (p?: Partial<UserParams> | null) =>
  !!p?.studium && !!p?.obdobi && !!p?.studentId && !!p?.fullName;

/**
 * Who is signed in, and everything derived from that.
 *
 * The record is a CACHE OF AN IDENTITY, and that is the whole reason this
 * function is shaped the way it is. Once per context it confirms with IS that
 * the stored record still describes the person whose session this is, and only
 * then serves it.
 *
 * Without that confirmation a complete record was never revalidated again:
 * sign out, hand the laptop over, and the next student's crawl went out
 * carrying the PREVIOUS student's `studium`. IS answers a foreign `studium`
 * with its plain search form rather than an error, so every parse came back
 * empty and nothing reported a failure — the new student simply had no data,
 * on an install that had to be deleted and re-added to recover.
 *
 * The check costs one small `studium.pl` per context per session, and only on
 * a positive answer naming someone else does anything get deleted: a fetch
 * that fails is offline, not a new student.
 */
export async function getUserParams(): Promise<UserParams | null> {
  if (_wrongStudentOnDisk) return null;
  // A check in flight answers first, BEFORE the cache: it sets
  // `_identityChecked` as soon as IS names someone, then waits on the wipe, and
  // a read in that window used to pass the shortcut below and get the previous
  // student's cached record as if it were confirmed.
  if (_inflight) return _inflight;
  // The cached record is served straight back once the identity behind it has
  // been confirmed. Until then it is only the best guess available, so a later
  // call is allowed to try the check again — see IDENTITY_RECHECK_GAP_MS.
  if (
    _cached &&
    ((_identityChecked && !_studiesPending) ||
      Date.now() - _lastIdentityAttempt < IDENTITY_RECHECK_GAP_MS)
  )
    return _cached;

  _inflight = (async () => {
    // Hoisted so the catch below can still fall back to it: the refetch this
    // function performs can REJECT (offline, an auth bounce, a truncated
    // body), and a rejection reaching the outer catch returned null and threw
    // away a perfectly usable record.
    let stored: Partial<UserParams> | undefined;
    // Outside the try, because the catch has to know: once the wipe below has
    // run, the record it wiped must never be served again, whatever fails
    // afterwards.
    let switched = false;
    // Set only once `clearAll` has RESOLVED. `switched` is decided before the
    // wipe, so on its own it cannot tell a wipe that failed from one that ran.
    let wiped = false;
    try {
      stored = (await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS)) as
        Partial<UserParams> | undefined;
      // Already confirmed against the live session in this context.
      if (complete(stored) && _identityChecked && !_studiesPending) {
        _cached = stored as UserParams;
        return _cached;
      }

      // A refetch that fails must not cost the student what is already
      // stored: a stale record still has their studium on it, which is
      // what most of the app reads, and the next launch tries again.
      _lastIdentityAttempt = Date.now();
      const base = await fetchUserBaseIds();
      if (!base) return serveStored(stored);

      // IS has answered WITH AN IDENTITY on it — and only then does this
      // context know who is signed in. A page that parses without one (IS
      // answering in a language the regexes do not read, a truncated body)
      // proves nothing: claiming it as a confirmation would stop the watcher
      // retrying and freeze the previous student's record in place for the
      // whole session. The record is still built below, because a first
      // install with no `studium` at all is worse than an unconfirmed one.
      if (base.studentId) _identityChecked = true;

      // The only thing that may delete a student's data: IS naming a
      // different person than the stored record does. Both ids have to be
      // present — an English `studium.pl` used to parse to an empty
      // `studentId`, and treating that as "somebody else" would wipe a
      // healthy install.
      //
      // The id alone, not `complete()`: that also wants a name, and a stored
      // record with the previous student's id but no name skipped the wipe and
      // had the new student's params written over it. A record with no id at
      // all cannot be attributed and is repaired below, not wiped — that shape
      // is the same student's English half-record, and a wipe would take their
      // local-only notes with it.
      switched = !!stored?.studentId && !!base.studentId && stored.studentId !== base.studentId;

      if (switched) {
        // Nothing may serve the previous student's record from here on, even
        // while the wipe below is still running.
        _cached = null;
        // Before the new record is written, not after: `clearAll` would take
        // the new student's own params straight back out again, and the next
        // boot would have nothing to check against.
        await IndexedDBService.clearAll();
        wiped = true;
      }

      // More than one study in IS: which one reIS reads, decided from IS
      // every session — so a record left on an interrupted study (installs
      // from before this check) corrects itself on the next start. A
      // single-study page has no select, and that path is unchanged.
      const { options = [], ...baseFields } = base;
      const optionsKey = options.map((o) => o.studium).join(',');
      const resolvedRecently =
        !switched &&
        !_forceResolve &&
        stored?.studiesResolvedFor === optionsKey &&
        Date.now() - (stored.studiesResolvedAt ?? 0) < STUDIES_RECHECK_MS;
      let multi: ResolvedStudies | null = null;
      if (options.length > 1 && !resolvedRecently) {
        try {
          multi = await resolveStudies(
            options,
            switched ? undefined : stored?.studium,
            switched ? [] : (stored?.studies ?? [])
          );
          // A partial answer is used, but re-asked after the recheck gap,
          // and not stamped as the day's resolution (see `resolved`).
          _studiesPending = multi.complete === false;
          _forceResolve = false;
        } catch (e) {
          // With a record of this student's, keep its study: the catch
          // below serves it, and the recheck gap asks again. With none — a
          // first install, a new student — IS's own default study beats
          // nothing, which is what reIS used before it read studies.
          if (!switched && stored?.studium) {
            _studiesPending = true;
            throw e;
          }
          // Still unconfirmed: ask again after the gap rather than keep IS's
          // default — an interrupted study, maybe — for the whole session.
          _studiesPending = true;
          logError('getUserParams.resolveStudies', e);
        }
      }
      const resolved = <T extends UserParams>(p: T): T =>
        multi && multi.complete !== false
          ? { ...p, studiesResolvedFor: optionsKey, studiesResolvedAt: Date.now() }
          : p;
      // A record with studies whose page no longer has a select (a study
      // ended): rebuilt once from IS's one study, and the switcher goes.
      const staleStudies = options.length <= 1 && !!stored?.studies;
      // One study, but not the stored one (the extension's two databases
      // can be reset apart): rebuilt from IS's, so the two contexts agree.
      // A healthy single-study record never takes this — same studium.
      const studyMoved =
        options.length <= 1 &&
        !!stored?.studium &&
        !!base.studium &&
        stored.studium !== base.studium;

      if (!switched && complete(stored) && !staleStudies && !studyMoved) {
        // Same student. Serve the record as it stands rather than rebuilding
        // it — the rebuild below is two more IS pages, on every boot. With
        // more than one study it is only re-pointed, from what IS just said.
        let same = multi
          ? resolved(withStudy(stored as UserParams, multi))
          : (stored as UserParams);
        if (JSON.stringify(same) !== JSON.stringify(stored)) {
          // The study pages took a while: another context (another IS tab)
          // may have switched study meanwhile. Its choice wins over a write
          // built from the record as it was before.
          const now = await readStoredSwitch(stored);
          if (now) same = now;
          else await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, same);
        }
        _cached = same;
        return _cached;
      }

      const study = await fetchUserStudyDetails(),
        net = await fetchUserNetId();
      const built: UserParams = {
        ...baseFields,
        ...study,
        ...net,
        email: net.username ? `${net.username}@mendelu.cz` : '',
        isErasmus: base.isErasmus,
      };
      // Not re-resolved because the stored resolution is recent: the study
      // is the stored one, not IS's default that `built` was read from.
      // (Incomplete records — no parsed name — rebuild on every start, and
      // without this, every other start wrote the default study back.)
      let params = multi
        ? resolved(withStudy(built, multi))
        : resolvedRecently && stored
          ? { ...built, ...studyFieldsOf(stored) }
          : built;
      // Same guard as the branch above, for records that are not complete
      // (no parsed name): a switch another context made while this rebuild
      // read IS wins over a record built from before it.
      const now = multi && !switched ? await readStoredSwitch(stored) : null;
      if (now) params = now;
      else await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, params);
      _cached = params;
      if (switched) announceIdentityChange(params, { wiped: true });
      return params;
    } catch (e) {
      logError('getUserParams', e);

      // Not once the wipe has already run. Everything after it can throw — the
      // two detail pages, the write — and falling back to `stored` there hands
      // back the record of the student who just LEFT, caches it for the
      // session, and skips the announcement that restarts the app. The new
      // student would be left with an emptied database and a crawl going out
      // under the old `studium`, which is the failure this whole check exists
      // to end. Nothing beats a stale identity that is known to be the wrong
      // person's: the next call finds the emptied store and rebuilds.
      //
      // Unless the wipe itself is what threw. Then the record is still on disk,
      // and asking the app to restart looped: the next boot recomputed the same
      // switch, the wipe failed the same way, and it reloaded again, uncapped.
      // The app is still told — the society login goes either way — but with
      // `wiped: false`, and this context serves nothing until a sign-out.
      if (switched) {
        _cached = null;
        if (!wiped) _wrongStudentOnDisk = true;
        announceIdentityChange(null, { wiped });
        return null;
      }

      // Otherwise stale identity beats none: `studium` is what the schedule,
      // the study plan, the teaching weeks and the grade history all read, and
      // the next launch tries the repair again.
      return serveStored(stored);
    }
  })();

  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

/**
 * The stored record, if another context switched study since `before` was
 * read — the student's newer choice, which a write built from `before`
 * would otherwise undo.
 */
async function readStoredSwitch(before?: Partial<UserParams>): Promise<UserParams | null> {
  const now = (await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS)) as
    UserParams | undefined;
  return now &&
    now.studium !== before?.studium &&
    now.studies?.some((s) => s.studium === now.studium)
    ? now
    : null;
}

/**
 * Fall back to what is already on the device, IS having said nothing usable.
 *
 * A complete record is cached for the rest of the session even though it is
 * unconfirmed. ~20 call sites read these params, and without the cache an
 * offline boot would send every one of them at IS again — a fetch storm in
 * exactly the condition where fetches are failing. The identity is re-checked
 * on the next boot.
 */
function serveStored(stored?: Partial<UserParams>): UserParams | null {
  // An incomplete record too, while its studies are pending: uncached, each
  // of the ~20 call sites would re-send the study pages, not wait the gap.
  if (complete(stored) || (_studiesPending && stored?.studium)) _cached = stored as UserParams;
  return (stored as UserParams | undefined) ?? null;
}

/**
 * Has IS confirmed, in this context and this session, who is signed in?
 *
 * False means the record being served is the best guess available and nothing
 * has checked it — either the check has not run yet or it could not reach IS.
 */
export function isIdentityConfirmed(): boolean {
  return _identityChecked;
}

/**
 * Clear the in-memory cache (call on logout).
 *
 * The identity check goes with it: the cache is being dropped precisely
 * because who is signed in is about to change, so the next read has to ask IS
 * again rather than trust a confirmation that was about the old session.
 */
export function clearUserParamsCache() {
  _cached = null;
  _identityChecked = false;
  _lastIdentityAttempt = 0;
  _wrongStudentOnDisk = false;
  _studiesPending = false;
  _forceResolve = false;
}

/**
 * Point reIS at another of the student's ACTIVE studies (the switcher).
 *
 * The same student, so none of the identity machinery runs: no wipe, no
 * announcement — the record is re-pointed and written back. No network
 * either: the studies were resolved from IS when the record was built, which
 * is what lets the extension's two contexts and the phone call it twice for
 * one switch at no cost. `studium` arrives over postMessage, so anything
 * that is not one of the stored active studies is refused.
 */
export function selectStudy(studium: string): Promise<{ params: UserParams; changed: boolean }> {
  // One at a time. A forward switch and the rollback the caller sends after
  // a timeout can both be queued here; read-then-write interleaved, the
  // rollback saw the old study, did nothing, and the forward one landed.
  const next = _selecting.then(() => selectStudyNow(studium));
  _selecting = next.catch(() => undefined);
  return next;
}
let _selecting: Promise<unknown> = Promise.resolve();

async function selectStudyNow(studium: string): Promise<{ params: UserParams; changed: boolean }> {
  if (_inflight) await _inflight.catch(() => null);
  // Never act on a record this context has not checked against IS.
  if (!_cached) await getUserParams();
  // The shared record first: another IS tab may have switched it since this
  // context cached its own, and a switch "back" to what this one caches
  // would otherwise be a no-op that leaves the record on the other study.
  const shared = (await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS)) as
    UserParams | undefined;
  let current =
    shared && (!_cached || shared.studentId === _cached.studentId) ? shared : (_cached ?? shared);
  let target = current?.studies?.find((s) => s.studium === studium);
  if (current && !target) {
    // This context's list may be missing or stale: its study pages failed
    // when the record was built, while the other context's did not. Ask IS
    // once more before refusing — the same check a new session runs.
    _cached = null;
    _identityChecked = false;
    _lastIdentityAttempt = 0;
    _forceResolve = true;
    current = (await getUserParams()) ?? undefined;
    _forceResolve = false;
    target = current?.studies?.find((s) => s.studium === studium);
  }
  if (!current?.studies || !target) throw new Error('selectStudy: not an active study');
  if (current.studium === studium) return { params: current, changed: false };
  const next = withStudy(current, { active: current.studies, chosen: target });
  await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, next);
  _cached = next;
  return { params: next, changed: true };
}

/**
 * Follow a switch made in ANOTHER context of the same origin — another IS
 * tab's content script. Each holds its own confirmed `_cached` for the whole
 * session, so without this its crawls kept fetching the study the student
 * had just left. Called at the start of each crawl; only a multi-study
 * record pays the one IndexedDB read.
 */
export async function adoptStoredStudy(): Promise<void> {
  if (_inflight || !_cached?.studies) return;
  const stored = (await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS)) as
    UserParams | undefined;
  if (
    stored &&
    _cached &&
    stored.studentId === _cached.studentId &&
    stored.studium !== _cached.studium &&
    stored.studies?.some((s) => s.studium === stored.studium)
  )
    _cached = stored;
}

export async function getStudium(): Promise<string | null> {
  return (await getUserParams())?.studium ?? null;
}
export async function getFaculty(): Promise<string | null> {
  return (await getUserParams())?.facultyId ?? null;
}
export async function getErasmus(): Promise<boolean> {
  return (await getUserParams())?.isErasmus ?? false;
}
