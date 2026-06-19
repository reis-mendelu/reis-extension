import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import cs from '../locales/cs.json';

const NEW_KEYS = [
  'targetWindows',
  'getEduroamWindows',
  'windowsDownloaded',
  'windowsStep0',
  'windowsStep1',
  'windowsStep2',
  'windowsStep3',
  'privacyNoteLocal',
  'privacyNoteTransfer',
] as const;

describe('eduroam Windows i18n keys', () => {
  it.each(NEW_KEYS)('en.eduroam.%s is a non-empty string', (key) => {
    const v = (en.eduroam as Record<string, string>)[key];
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it.each(NEW_KEYS)('cs.eduroam.%s is a non-empty string', (key) => {
    const v = (cs.eduroam as Record<string, string>)[key];
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });
});
