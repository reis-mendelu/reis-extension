import { useAppStore } from '../store/useAppStore';
import { NOVINKY_KIND } from './novinkyPost';

/** 5.7.x posted "Nové body" under this kind; one may still be in the tray. */
const LEGACY_POINTS_KIND = 'zaznamnik-new-points';

function openSubject(courseCode: string): void {
  const store = useAppStore.getState();
  const s = store.subjects?.data?.[courseCode];
  store.setMobileTab('subjects');
  store.pushSheet({
    kind: 'subjectDrawer',
    courseCode,
    courseName: (store.language === 'en' ? s?.nameEn : s?.nameCs) || s?.displayName || courseCode,
    courseId: s?.subjectId,
    initialTab: 'zaznamnik',
  });
}

/**
 * A tap opens what tapping the row in Novinky opens: Zkoušky for new terms, the
 * subject's Záznamník for points or a box in one subject, Novinky otherwise.
 * Other features' taps are ignored.
 */
export function openNovinkyFromNotification(extra: unknown): void {
  const e = extra as { kind?: unknown; group?: unknown; courseCode?: unknown } | null | undefined;
  const store = useAppStore.getState();
  if (e?.kind === LEGACY_POINTS_KIND) {
    if (typeof e.courseCode === 'string') openSubject(e.courseCode);
    else store.pushSheet({ kind: 'notifications' });
    return;
  }
  if (e?.kind !== NOVINKY_KIND) return;
  if (e.group === 'terms') {
    store.setMobileTab('exams');
    return;
  }
  if ((e.group === 'points' || e.group === 'boxes') && typeof e.courseCode === 'string') {
    openSubject(e.courseCode);
    return;
  }
  store.pushSheet({ kind: 'notifications' });
}
