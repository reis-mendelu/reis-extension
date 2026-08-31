import { IndexedDBService } from '../services/storage';
import { STORAGE_KEYS } from '../services/storage/keys';
import { fetchUserBaseIds, fetchUserStudyDetails, fetchUserNetId } from './userParams/fetchers';
import { logError } from './reportError';

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

export async function getUserParams(): Promise<UserParams | null> {
  if (_cached) return _cached;
  // Dedup: if a fetch is already in-flight, share its promise
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const stored = await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS);
      // `studium`/`obdobi` alone are not a complete record. They are the
      // two fields that carry no words, so they survived an English
      // `studium.pl` that left `studentId` and `fullName` empty — and
      // this early return then served that half-record forever, outliving
      // the parser bug that wrote it and leaving the student's own photo
      // permanently unreachable. Identity is part of the bar now, so an
      // install carrying one of those records repairs itself on the next
      // launch instead of needing a reinstall.
      const complete = (p?: Partial<UserParams> | null) =>
        !!p?.studium && !!p?.obdobi && !!p?.studentId && !!p?.fullName;
      if (complete(stored)) {
        _cached = stored as UserParams;
        return _cached;
      }

      // A refetch that fails must not cost the student what is already
      // stored: a stale record still has their studium on it, which is
      // what most of the app reads, and the next launch tries again.
      const base = await fetchUserBaseIds();
      if (!base) return (stored as UserParams | undefined) ?? null;
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
      return params;
    } catch (e) {
      logError('getUserParams', e);
      return null;
    }
  })();

  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

/** Clear the in-memory cache (call on logout). */
export function clearUserParamsCache() {
  _cached = null;
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
