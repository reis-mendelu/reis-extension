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
    IndexedDBService.get('meta', PICKS_IDB_KEY).then(v => {
      if (Array.isArray(v)) setPicks(new Set(v as string[]));
    }).catch(() => {});
  }, []);

  const togglePick = useCallback((name: string) => {
    setPicks(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      IndexedDBService.set('meta', PICKS_IDB_KEY, [...next]).catch(() => {});
      return next;
    });
  }, []);

  return { effectivePicks: picks, togglePick };
}
