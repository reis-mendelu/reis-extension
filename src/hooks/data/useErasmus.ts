import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function useErasmus() {
  const data = useAppStore(s => s.erasmusData);
  const loading = useAppStore(s => s.erasmusLoading);

  useEffect(() => {
    if (!data) useAppStore.getState().fetchErasmusReports();
  }, [data]);

  return { data, loading, reports: data?.reports ?? [] };
}
