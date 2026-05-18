import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IndexedDBService } from '@/services/storage';
import { logError } from '@/utils/reportError';
import type { StudyPlan } from '@/types/studyPlan';
import { getSemesterState } from './utils';

const IDB_KEY = 'subjects_open_semesters';

export function useOpenSemesters(plan: StudyPlan | null) {
  const [openSemesters, setOpenSemesters] = useState<Set<number>>(new Set());
  const [idbLoaded, setIdbLoaded] = useState(false);
  const scrolledRef = useRef(false);
  const currentSemesterRef = useRef<HTMLDivElement | null>(null);

  const currentSemesterIndices = useMemo(() => {
    if (!plan) return new Set<number>();
    const indices = new Set<number>();
    plan.blocks.forEach((block, i) => {
      if (getSemesterState(block) === 'current') indices.add(i);
    });
    return indices;
  }, [plan]);

  useEffect(() => {
    IndexedDBService.get('meta', IDB_KEY)
      .then((stored) => {
        if (Array.isArray(stored) && stored.length > 0) setOpenSemesters(new Set(stored as number[]));
        else setOpenSemesters(currentSemesterIndices);
        setIdbLoaded(true);
      })
      .catch(() => { setOpenSemesters(currentSemesterIndices); setIdbLoaded(true); });
  }, [currentSemesterIndices]);

  useEffect(() => {
    if (!idbLoaded) return;
    IndexedDBService.set('meta', IDB_KEY, Array.from(openSemesters)).catch(e => logError('SubjectsPanel.persistOpenSemesters', e));
  }, [openSemesters, idbLoaded]);

  useEffect(() => {
    if (scrolledRef.current || !idbLoaded || !plan) return;
    if (currentSemesterIndices.size === 0) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      currentSemesterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [idbLoaded, plan, currentSemesterIndices]);

  const handleToggle = useCallback((index: number) => {
    setOpenSemesters(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  return { openSemesters, currentSemesterIndices, currentSemesterRef, handleToggle };
}
