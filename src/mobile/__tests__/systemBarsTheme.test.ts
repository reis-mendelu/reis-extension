import { describe, it, expect, vi, afterEach } from 'vitest';
import { barStyleForTheme, syncSystemBarsToTheme } from '../systemBarsTheme';

describe('barStyleForTheme', () => {
  it('asks for light icons on the dark theme and dark icons on the light one', () => {
    expect(barStyleForTheme('mendelu-dark')).toBe('DARK');
    expect(barStyleForTheme('mendelu')).toBe('LIGHT');
  });

  it('treats a missing or unknown theme as the default dark one', () => {
    expect(barStyleForTheme(null)).toBe('DARK');
    expect(barStyleForTheme('nonsense')).toBe('DARK');
  });
});

describe('syncSystemBarsToTheme', () => {
  afterEach(() => document.documentElement.setAttribute('data-theme', 'mendelu-dark'));

  it('applies the theme already on <html> without waiting for a change', () => {
    document.documentElement.setAttribute('data-theme', 'mendelu-dark');
    const setStyle = vi.fn();
    const stop = syncSystemBarsToTheme(document.documentElement, setStyle);
    expect(setStyle).toHaveBeenCalledWith('DARK');
    stop();
  });

  it('follows every later data-theme change', async () => {
    const setStyle = vi.fn();
    const stop = syncSystemBarsToTheme(document.documentElement, setStyle);
    document.documentElement.setAttribute('data-theme', 'mendelu');
    await Promise.resolve();
    expect(setStyle).toHaveBeenLastCalledWith('LIGHT');
    stop();
  });
});
