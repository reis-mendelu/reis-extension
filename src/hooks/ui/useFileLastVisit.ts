import { useEffect, useState } from 'react';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/**
 * When the student last opened this subject's files, for the "NOVÉ" badge on
 * documents changed since then — and this open recorded for next time.
 *
 * `undefined` while loading, `null` on a first visit or when storage fails
 * (nothing is marked new then). Both drawers use it: the extension's always
 * did, inline; the phone/iPad sheet never read the visit, so the badge could
 * not appear there (release check, 11 November 2026).
 *
 * The value is kept with the course it belongs to, so a sheet reused for
 * another subject never shows the previous subject's visit, not even for the
 * one render before the new read lands.
 */
export function useFileLastVisit(courseCode: string | undefined, open: boolean) {
  const [visit, setVisit] = useState<{ code: string; at: number | null } | null>(null);

  useEffect(() => {
    if (!open || !courseCode) return;
    let isCurrent = true;
    const key = `file_last_visit_${courseCode}`;
    IndexedDBService.get('meta', key)
      .then((prev) => {
        if (!isCurrent) return;
        setVisit({ code: courseCode, at: typeof prev === 'number' ? prev : null });
        return IndexedDBService.set('meta', key, Date.now());
      })
      .catch((err) => {
        logError('useFileLastVisit.load', err);
        if (isCurrent) setVisit({ code: courseCode, at: null });
      });
    return () => {
      isCurrent = false;
      // Forget it when this request ends (close, another subject): the
      // extension's drawer stays mounted, and a reopen would otherwise show
      // the visit from before the previous open until the new read lands.
      setVisit(null);
    };
  }, [open, courseCode]);

  return open && visit && visit.code === courseCode ? visit.at : undefined;
}
