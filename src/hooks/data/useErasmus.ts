import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function useErasmus() {
  const data = useAppStore(s => s.erasmusData);
  const loading = useAppStore(s => s.erasmusLoading);
  const countryFile = useAppStore(s => s.erasmusCountryFile);
  const setCountry = useAppStore(s => s.setErasmusCountry);

  useEffect(() => {
    if (!data) useAppStore.getState().fetchErasmusReports();
  }, [data]);

  return { data, loading, reports: data?.reports ?? [], countryFile, setCountry };
}
