import { describe, it, expect } from 'vitest';
import { EDUROAM_MANUAL, manualKey } from '../manual';
import cs from '../../../i18n/locales/cs.json';
import en from '../../../i18n/locales/en.json';

function leaf(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined,
      obj
    );
}

describe('EDUROAM_MANUAL', () => {
  const targets = ['mac', 'windows'] as const;

  it('builds dotted manual keys', () => {
    expect(manualKey('ios', 'steps', 0, 'text')).toBe('eduroam.manual.ios.steps.0.text');
    expect(manualKey('mac', 'hint')).toBe('eduroam.manual.mac.hint');
  });

  it('every device has exactly one qr-or-download action step', () => {
    for (const t of targets) {
      const actions = EDUROAM_MANUAL[t].steps.filter(
        (s) => s.action === 'qr' || s.action === 'download'
      );
      expect(actions).toHaveLength(1);
    }
  });

  it('every device has exactly one password step', () => {
    for (const t of targets) {
      expect(EDUROAM_MANUAL[t].steps.filter((s) => s.password)).toHaveLength(1);
    }
  });

  // Phones are gone from the desktop drawer: the reIS app configures them
  // natively, so the browser has no device but the one it is running on.
  it('offers only the machine reIS is running on', () => {
    expect(Object.keys(EDUROAM_MANUAL).sort()).toEqual(['mac', 'windows']);
  });

  it('only mac has an openSettings step; only windows has doOnceUrl', () => {
    expect(EDUROAM_MANUAL.mac.steps.some((s) => s.action === 'openSettings')).toBe(true);
    expect(EDUROAM_MANUAL.windows.doOnceUrl).toBeTruthy();
    expect(EDUROAM_MANUAL.mac.doOnceUrl).toBeUndefined();
  });

  it('every referenced i18n key resolves to a string in both locales', () => {
    for (const t of targets) {
      for (const dict of [cs, en]) {
        expect(typeof leaf(dict, manualKey(t, 'hint'))).toBe('string');
        EDUROAM_MANUAL[t].steps.forEach((_: unknown, i: number) => {
          expect(typeof leaf(dict, manualKey(t, 'steps', i, 'text'))).toBe('string');
          expect(typeof leaf(dict, manualKey(t, 'steps', i, 'shot'))).toBe('string');
        });
      }
    }
  });
});
