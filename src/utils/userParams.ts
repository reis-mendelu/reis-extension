import { IndexedDBService } from '../services/storage';
import { STORAGE_KEYS } from '../services/storage/keys';
import { fetchUserBaseIds, fetchUserStudyDetails, fetchUserNetId } from './userParams/fetchers';
import { logError } from './reportError';
import { announceIdentityChange } from './userParams/identityEvents';

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
  if (_cached && (_identityChecked || Date.now() - _lastIdentityAttempt < IDENTITY_RECHECK_GAP_MS))
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
      if (complete(stored) && _identityChecked) {
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
      } else if (complete(stored)) {
        // Same student. Serve the record as it stands rather than rebuilding
        // it — the rebuild below is two more IS pages, on every boot.
        _cached = stored as UserParams;
        return _cached;
      }

      const study = await fetchUserStudyDetails(),
        net = await fetchUserNetId();
      const params: UserParams = {
        ...base,
        ...study,
        ...net,
        email: net.username ? `${net.username}@mendelu.cz` : '',
        isErasmus: base.isErasmus,
      };
      await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, params);
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
 * Fall back to what is already on the device, IS having said nothing usable.
 *
 * A complete record is cached for the rest of the session even though it is
 * unconfirmed. ~20 call sites read these params, and without the cache an
 * offline boot would send every one of them at IS again — a fetch storm in
 * exactly the condition where fetches are failing. The identity is re-checked
 * on the next boot.
 */
function serveStored(stored?: Partial<UserParams>): UserParams | null {
  if (complete(stored)) _cached = stored as UserParams;
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
