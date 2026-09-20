import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Theme, UseThemeResult } from '../store/types';

export function useTheme(): UseThemeResult {
  const theme = useAppStore((state) => state.theme);
  const isLoading = useAppStore((state) => state.isThemeLoading);
  const setThemeAction = useAppStore((state) => state.setTheme);

  const toggle = useCallback(() => {
    const newTheme: Theme = theme === 'mendelu' ? 'mendelu-dark' : 'mendelu';
    setThemeAction(newTheme);
  }, [theme, setThemeAction]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeAction(newTheme);
    },
    [setThemeAction]
  );

  return {
    theme,
    isDark: theme === 'mendelu-dark',
    isLoading,
    toggle,
    setTheme,
  };
}
