import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function useErasmus() {
  const data = useAppStore(s => s.erasmusData);
  const loading = useAppStore(s => s.erasmusLoading);
  const countryFile = useAppStore(s => s.erasmusCountryFile);
  const setCountry = useAppStore(s => s.setErasmusCountry);
  const config = useAppStore(s => s.erasmusConfig);

  useEffect(() => {
    if (countryFile && !data) useAppStore.getState().fetchErasmusReports();
    if (!config) useAppStore.getState().fetchErasmusConfig();
  }, [countryFile, data, config]);

  return { data, loading, reports: data?.reports ?? [], countryFile, setCountry, config };
}
