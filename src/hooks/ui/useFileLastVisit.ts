import { useEffect, useState } from 'react';
import { IndexedDBService } from '../../services/storage/IndexedDBService';

/**
 * When the student last opened this subject's files, for the "NOVÉ" badge on
 * documents changed since then — and this open recorded for next time.
 *
 * `undefined` while loading, `null` on a first visit (nothing is new then).
 * Both drawers use it: the extension's always did, inline; the phone/iPad
 * sheet never read the visit, so the badge could not appear there (release
 * check, 11 November 2026).
 */
export function useFileLastVisit(courseCode: string | undefined, open: boolean) {
  const [lastVisitedAt, setLastVisitedAt] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!open || !courseCode) return;
    let isCurrent = true;
    // Reset a stale timestamp when switching subjects, before the async load below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastVisitedAt(undefined);
    const key = `file_last_visit_${courseCode}`;
    IndexedDBService.get('meta', key).then((prev) => {
      if (!isCurrent) return;
      setLastVisitedAt(prev ?? null);
      IndexedDBService.set('meta', key, Date.now());
    });
    return () => {
      isCurrent = false;
    };
  }, [open, courseCode]);

  return lastVisitedAt;
}
