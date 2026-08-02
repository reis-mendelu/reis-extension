import { useCallback, useEffect, useState } from 'react';
import { IndexedDBService } from '@/services/storage';

const PICKS_IDB_KEY = 'subjects_zamerani_picks';

export interface ZameraniPicks {
  effectivePicks: Set<string>;
  togglePick: (normalizedName: string) => void;
}

export function useZameraniPicks(): ZameraniPicks {
  const [picks, setPicks] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Same unmount guard as useOpenSemesters: this hook is in the same tree,
    // so a late resolve would land after teardown for exactly the same reason.
    let alive = true;
    IndexedDBService.get('meta', PICKS_IDB_KEY)
      .then((v) => {
        if (alive && Array.isArray(v)) setPicks(new Set(v as string[]));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const togglePick = useCallback((name: string) => {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      IndexedDBService.set('meta', PICKS_IDB_KEY, [...next]).catch(() => {});
      return next;
    });
  }, []);

  return { effectivePicks: picks, togglePick };
}
