import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { University } from '../../types/erasmus';

const EMPTY: University[] = [];

export function useUniversities(alpha2: string | null) {
  const universities = useAppStore(s => (alpha2 ? s.universities[alpha2] : undefined) ?? EMPTY);
  const loading = useAppStore(s => alpha2 ? (s.universitiesLoading[alpha2] ?? false) : false);

  useEffect(() => {
    if (alpha2) useAppStore.getState().fetchUniversities(alpha2);
  }, [alpha2]);

  return { universities, loading };
}
