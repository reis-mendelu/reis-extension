import { afterEach, describe, expect, it, vi } from 'vitest';
import { ISO_ATTRIBUTION, isoDzi, isoMapBase, isoMapEnabled, isoSeason } from '../isoMap';

afterEach(() => vi.unstubAllEnvs());

describe('isometric map config', () => {
  it('is off until VITE_ISO_MAP_URL names where the tiles are', () => {
    vi.stubEnv('VITE_ISO_MAP_URL', ''); // a developer's .env.local may switch it on
    expect(isoMapEnabled()).toBe(false);
    expect(isoMapBase()).toBeNull();
    vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
    expect(isoMapEnabled()).toBe(true);
  });

  it('drops a trailing slash so the tile URL has exactly one', () => {
    vi.stubEnv('VITE_ISO_MAP_URL', 'https://tiles.example.org/iso/');
    expect(isoMapBase()).toBe('https://tiles.example.org/iso');
  });

  it('treats a blank value as off', () => {
    vi.stubEnv('VITE_ISO_MAP_URL', '   ');
    expect(isoMapEnabled()).toBe(false);
  });

  it('describes the pyramid izomapa wrote, one folder per season', () => {
    const dzi = isoDzi('http://localhost:8793/tiles', 'summer');
    expect(dzi.Image.Url).toBe('http://localhost:8793/tiles/summer/');
    expect(dzi.Image.Format).toBe('webp');
    expect(dzi.Image.TileSize).toBe('512');
    expect(dzi.Image.Overlap).toBe('0');
    expect(dzi.Image.Size).toEqual({ Width: '12501', Height: '9559' });
  });

  it('carries the credit the data licences ask for', () => {
    expect(ISO_ATTRIBUTION).toBe('© přispěvatelé OpenStreetMap, © ČÚZK');
  });

  it('opens on summer, and only the dev server takes another season from the URL', () => {
    expect(isoSeason()).toBe('summer');
    window.history.replaceState(null, '', '/?isoSeason=winter');
    expect(isoSeason()).toBe('winter');
    window.history.replaceState(null, '', '/?isoSeason=nonsense');
    expect(isoSeason()).toBe('summer');
    window.history.replaceState(null, '', '/');
  });
});
