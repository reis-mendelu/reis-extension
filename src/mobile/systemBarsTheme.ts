/**
 * Keeps the Android status-bar icons legible against the app's own theme.
 *
 * The app draws edge-to-edge (Android 15+ enforces it; MainActivity opts
 * Android ≤14 in), so the status bar is transparent over the app's background.
 * Capacitor's SystemBars defaults to following the SYSTEM night mode, which is
 * the wrong signal: a student on the dark reIS theme with a light system gets
 * dark icons on a dark bar — an invisible clock. The in-app theme decides.
 *
 * Style names are Capacitor's: 'DARK' = light icons for a dark background.
 */
export type BarStyle = 'DARK' | 'LIGHT';

export function barStyleForTheme(theme: string | null): BarStyle {
  return theme === 'mendelu' ? 'LIGHT' : 'DARK';
}

/**
 * Applies the current `data-theme` immediately, then on every change. Watches
 * the attribute rather than the store because every theme path (loadTheme,
 * setTheme, the cross-tab listener) ends by writing it. Returns a stop function.
 */
export function syncSystemBarsToTheme(
  root: HTMLElement,
  setStyle: (style: BarStyle) => void,
): () => void {
  const apply = () => setStyle(barStyleForTheme(root.getAttribute('data-theme')));
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
