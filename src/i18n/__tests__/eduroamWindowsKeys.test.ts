import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import cs from '../locales/cs.json';

// Flat (non-manual) keys that must exist as non-empty strings.
const FLAT_KEYS = [
  'heroTitle', 'heroSub', 's1', 's2', 'doOnce', 'pwdLabel', 'copy', 'copied',
  'restart', 'footer', 'footerSub', 'download', 'createQr', 'preparing', 'error', 'regenerate',
  'openSettings', 'privacyNoteLocal', 'privacyNoteTransfer',
  'targetIos', 'targetAndroid', 'targetMac', 'targetWindows',
] as const;

// device -> number of steps in the manual
const DEVICE_STEPS: Record<string, number> = { ios: 4, android: 3, mac: 4, windows: 3 };
// Android is now the manual EAP-TLS flow (no geteduroam app), so only Windows
// keeps a do-once install-the-app step.
const DO_ONCE_DEVICES = ['windows'] as const;

function leaf(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

describe('eduroam i18n keys', () => {
  for (const [label, dict] of [['en', en], ['cs', cs]] as const) {
    describe(label, () => {
      it.each(FLAT_KEYS)('eduroam.%s is a non-empty string', (key) => {
        const v = leaf(dict, `eduroam.${key}`);
        expect(typeof v).toBe('string');
        expect((v as string).length).toBeGreaterThan(0);
      });

      it.each(Object.entries(DEVICE_STEPS))('manual.%s steps have text + shot', (device, count) => {
        const hint = leaf(dict, `eduroam.manual.${device}.hint`);
        expect(typeof hint).toBe('string');
        for (let i = 0; i < count; i++) {
          expect(typeof leaf(dict, `eduroam.manual.${device}.steps.${i}.text`)).toBe('string');
          expect(typeof leaf(dict, `eduroam.manual.${device}.steps.${i}.shot`)).toBe('string');
        }
        expect(typeof leaf(dict, `eduroam.manual.${device}.done.text`)).toBe('string');
        expect(typeof leaf(dict, `eduroam.manual.${device}.done.shot`)).toBe('string');
      });

      it.each(DO_ONCE_DEVICES)('manual.%s has do-once title + cta', (device) => {
        expect(typeof leaf(dict, `eduroam.manual.${device}.doOnce.title`)).toBe('string');
        expect(typeof leaf(dict, `eduroam.manual.${device}.doOnce.cta`)).toBe('string');
      });
    });
  }
});
