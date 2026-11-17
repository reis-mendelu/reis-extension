import type { AppSlice } from '../types';
import type { IsNotice, IsNoticeMute, IsNoticesByLang } from '../../types/isNotices';
import { IndexedDBService } from '../../services/storage';
import { fetchIsNotices } from '../../api/isNotices';
import { fetchIsNoticeMutes } from '../../api/isNoticeMutes';
import { muteIsNotice, unmuteIsNotice } from '../../api/isNoticeMutesAdmin';
import { isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';

export interface IsNoticesSlice {
  isNotices: IsNoticesByLang;
  isNoticesFetchedAt: number | null;
  isNoticesLoading: boolean;
  /** When IS was last ASKED, success or not: a lapsed session must not mean a request per refresh. */
  isNoticesTriedAt: number | null;
  isNoticeMutes: IsNoticeMute[];
  hydrateIsNotices: () => Promise<void>;
  loadIsNoticesIfStale: () => Promise<void>;
  /** reIS admin only. Resolves false when the write failed. */
  setIsNoticeMuted: (notice: Pick<IsNotice, 'key' | 'title'>, muted: boolean) => Promise<boolean>;
}

const TTL_MS = 30 * 60 * 1000;
const NOTICES_KEY = 'is_notices';
const MUTES_KEY = 'is_notice_mutes';

const EMPTY: IsNoticesByLang = { cz: [], en: [] };

/**
 * The notices IS shows on the student's own home page, both languages, and the
 * admin's mute list. Kept apart from `notifications` (the society feed): that
 * one is overwritten whole by every Supabase fetch and cached as
 * `notifications_cache`, and these are the student's own IS data, merged into
 * the feed only at read time (useNotificationFeed).
 */
export const createIsNoticesSlice: AppSlice<IsNoticesSlice> = (set, get) => ({
  isNotices: EMPTY,
  isNoticesFetchedAt: null,
  isNoticesLoading: false,
  isNoticesTriedAt: null,
  isNoticeMutes: [],

  hydrateIsNotices: async () => {
    // A cache from a real session never shows under the demo banner.
    if (isDemoMode() || get().demoMode) return;
    try {
      const [notices, mutes] = await Promise.all([
        IndexedDBService.get('meta', NOTICES_KEY),
        IndexedDBService.get('meta', MUTES_KEY),
      ]);
      // Only if nothing fresher landed while IndexedDB was answering.
      if (get().isNoticesFetchedAt === null && isByLang(notices)) set({ isNotices: notices });
      if (get().isNoticeMutes.length === 0 && Array.isArray(mutes)) {
        set({ isNoticeMutes: mutes as IsNoticeMute[] });
      }
    } catch {
      // A cache, nothing more: the next fetch fills it.
    }
  },

  loadIsNoticesIfStale: async () => {
    // The demo and the store reviewer's build reach nothing (check:app).
    if (isDemoMode() || import.meta.env.VITE_USE_MOCK_DATA === 'true') return;
    if (get().demoMode) return;
    const { isNoticesTriedAt, isNoticesLoading } = get();
    if (isNoticesLoading) return;
    // Counted from the last attempt, not the last success: with the IS
    // session gone, every five-minute feed refresh would otherwise ask IS
    // again for both languages.
    if (isNoticesTriedAt && Date.now() - isNoticesTriedAt < TTL_MS) return;

    set({ isNoticesLoading: true, isNoticesTriedAt: Date.now() });
    const [notices, mutes] = await Promise.all([
      Promise.all([fetchIsNotices('cz'), fetchIsNotices('en')]).then(
        ([cz, en]): IsNoticesByLang => ({ cz, en }),
        (e: unknown) => {
          logError('IsNoticesSlice.loadIsNoticesIfStale', e);
          return null;
        }
      ),
      fetchIsNoticeMutes(),
    ]);
    // A failed read keeps what we had: an empty list would read as "IS took
    // the notices down", and a failed mute read would un-mute everything.
    if (notices) {
      set({ isNotices: notices, isNoticesFetchedAt: Date.now() });
      await IndexedDBService.set('meta', NOTICES_KEY, notices).catch(() => {});
    }
    if (mutes) {
      set({ isNoticeMutes: mutes });
      await IndexedDBService.set('meta', MUTES_KEY, mutes).catch(() => {});
    }
    set({ isNoticesLoading: false });
  },

  setIsNoticeMuted: async (notice: Pick<IsNotice, 'key' | 'title'>, muted: boolean) => {
    const ok = muted
      ? await muteIsNotice(notice.key, notice.title)
      : await unmuteIsNotice(notice.key);
    if (!ok) return false;
    const rest = get().isNoticeMutes.filter((m) => m.key !== notice.key);
    const next = muted ? [...rest, { key: notice.key, title: notice.title }] : rest;
    set({ isNoticeMutes: next });
    await IndexedDBService.set('meta', MUTES_KEY, next).catch(() => {});
    return true;
  },
});

function isByLang(v: unknown): v is IsNoticesByLang {
  const o = v as IsNoticesByLang | null;
  return !!o && Array.isArray(o.cz) && Array.isArray(o.en);
}
