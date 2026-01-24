import { useState, useEffect, useCallback } from "react";
import { IndexedDBService } from "../services/storage";
import { syncService } from "../services/sync";

export type Theme = "mendelu" | "mendelu-dark";

export interface UseThemeResult {
  /** Current theme */
  theme: Theme;
  /** Whether theme is dark mode */
  isDark: boolean;
  /** Whether theme is loading from storage */
  isLoading: boolean;
  /** Toggle between light and dark theme */
  toggle: () => void;
  /** Set specific theme */
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "reis_theme";
const DEFAULT_THEME: Theme = "mendelu";

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  const loadTheme = useCallback(async () => {
    try {
      const storedTheme = await IndexedDBService.get("meta", STORAGE_KEY) as Theme | undefined;
      if (storedTheme && (storedTheme === "mendelu" || storedTheme === "mendelu-dark")) {
        setThemeState(storedTheme);
        applyTheme(storedTheme);
      } else {
        applyTheme(DEFAULT_THEME);
      }
    } catch (e) {
      console.error("[useTheme] Failed to load theme:", e);
      applyTheme(DEFAULT_THEME);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load theme from storage on mount
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // Listen for storage changes via syncService (sync across tabs/contexts)
  useEffect(() => {
    const unsubscribe = syncService.subscribe((type) => {
      if (type === 'THEME_UPDATE') {
        loadTheme();
      }
    });
    return unsubscribe;
  }, [loadTheme]);

  const applyTheme = (newTheme: Theme) => {
    // Set data-theme on <html> element (works in iframe)
    document.documentElement.setAttribute("data-theme", newTheme);
    // console.log("[useTheme] Applied theme:", newTheme);
  };

  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      await IndexedDBService.set("meta", STORAGE_KEY, newTheme);
      setThemeState(newTheme);
      applyTheme(newTheme);
      syncService.triggerRefresh('THEME_UPDATE');
      
      // Use BroadcastChannel to notify other tabs/contexts
      const bc = new BroadcastChannel('reis_theme_sync');
      bc.postMessage(newTheme);
      bc.close();
    } catch (e) {
      console.error("[useTheme] Failed to save theme:", e);
    }
  }, []);

  // Set up BroadcastChannel listener for cross-tab sync
  useEffect(() => {
    const bc = new BroadcastChannel('reis_theme_sync');
    bc.onmessage = (event) => {
      const newTheme = event.data as Theme;
      if (newTheme === "mendelu" || newTheme === "mendelu-dark") {
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    return () => bc.close();
  }, []);

  const toggle = useCallback(() => {
    const newTheme: Theme = theme === "mendelu" ? "mendelu-dark" : "mendelu";
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    isDark: theme === "mendelu-dark",
    isLoading,
    toggle,
    setTheme,
  };
}
