import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
const secureStorage = {
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
  remove: vi.fn(async (k: string) => void store.delete(k)),
};
vi.mock('../../../platform', () => ({
  getPlatform: () => ({ kind: 'capacitor', secureStorage }),
}));

import {
  __resetIskamJarForTests,
  clearJar,
  jarGeneration,
  loadJar,
  saveJar,
} from '../iskamCookieStore';
import type { IskamJar } from '../iskamJar';

const JAR: IskamJar = [
  { name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null },
];

describe('iskamCookieStore', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    __resetIskamJarForTests();
  });

  it('round-trips a jar through secureStorage as one JSON string', async () => {
    await saveJar(JAR);
    expect(secureStorage.set).toHaveBeenCalledWith('reis.iskam.jar', JSON.stringify(JAR));
    expect(await loadJar()).toEqual(JAR);
  });

  it('reads nothing as an empty jar: missing, unreadable, malformed, or foreign hosts', async () => {
    expect(await loadJar()).toEqual([]);
    store.set('reis.iskam.jar', '{not json');
    expect(await loadJar()).toEqual([]);
    store.set(
      'reis.iskam.jar',
      JSON.stringify([{ name: 'x', value: 'y', host: 'evil.example', path: '/', expires: null }])
    );
    expect(await loadJar()).toEqual([]);
    secureStorage.get.mockRejectedValueOnce(new Error('keystore'));
    expect(await loadJar()).toEqual([]);
  });

  it('drops a save based on a generation that a clear has since moved past', async () => {
    const gen = jarGeneration();
    await clearJar();
    expect(await saveJar(JAR, gen)).toBeNull();
    expect(store.has('reis.iskam.jar')).toBe(false);
  });

  it('a clear issued after a save lands last, even if the save is slow', async () => {
    let release!: () => void;
    secureStorage.set.mockImplementationOnce(
      (k: string, v: unknown) =>
        new Promise<void>((r) => {
          release = () => {
            store.set(k, v);
            r();
          };
        })
    );
    const saving = saveJar(JAR);
    const clearing = clearJar();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([saving, clearing]);
    expect(store.has('reis.iskam.jar')).toBe(false);
  });

  it('a clear based on a stale generation does not wipe a newer login', async () => {
    const gen = jarGeneration();
    await saveJar(JAR);
    expect(await clearJar(gen)).toBe(false);
    expect(await loadJar()).toEqual(JAR);
  });
});
