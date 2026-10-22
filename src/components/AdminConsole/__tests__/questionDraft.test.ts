import { describe, it, expect } from 'vitest';
import { draftError, draftToInput, newDraft, PRESETS } from '../questionDraft';

const NOW = new Date(2026, 9, 25, 9, 30);

describe('question drafts', () => {
  it('starts every preset with buttons the database accepts', () => {
    for (const p of PRESETS) {
      const keys = newDraft(p, NOW).buttons.map((b) => b.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.length).toBeGreaterThanOrEqual(1);
      expect(keys.length).toBeLessThanOrEqual(5);
      expect(keys).not.toContain('seen');
      for (const k of keys) expect(k).toMatch(/^[a-z0-9_]{1,20}$/);
    }
  });

  // The retired NpsBanner's own wording, so the new answers compare with its 131.
  it('the 1–5 preset is the satisfaction question, ready to publish', () => {
    const d = newDraft('scale', NOW);
    expect(d.promptCz).toBe('Doporučil/a bys reIS kamarádovi?');
    expect(draftError(d)).toBeNull();
    // Both ends labelled on the buttons, in both languages (Tonda, 2026-10-22).
    expect(d.buttons[0]).toMatchObject({ hintCz: 'nejhorší', hintEn: 'worst' });
    expect(d.buttons[4]).toMatchObject({ hintCz: 'nejlepší', hintEn: 'best' });
  });

  it('runs four weeks by default', () => {
    const d = newDraft('yesno', NOW);
    expect(Date.parse(d.endsAt) - Date.parse(d.startsAt)).toBe(28 * 86_400_000);
  });

  it('refuses an empty prompt, a missing label, a bare link and backwards dates', () => {
    expect(draftError(newDraft('yesno', NOW))).toBe('errPrompt');
    const ok = { ...newDraft('yesno', NOW), promptCz: 'A?', promptEn: 'A?' };
    expect(draftError(ok)).toBeNull();
    expect(draftError({ ...ok, buttons: [{ key: 'yes', cz: '', en: 'Yes' }] })).toBe('errLabels');
    expect(draftError({ ...ok, preset: 'link', buttons: newDraft('link', NOW).buttons })).toBe(
      'errUrl'
    );
    expect(draftError({ ...ok, endsAt: ok.startsAt })).toBe('errDates');
  });

  it('turns a draft into the row: trimmed, ISO dates, empty notes and faculties as null', () => {
    const input = draftToInput({
      ...newDraft('yesno', NOW),
      promptCz: ' A? ',
      promptEn: 'A?',
      faculties: [],
    });
    expect(input.promptCz).toBe('A?');
    expect(input.noteCz).toBeNull();
    expect(input.faculties).toBeNull();
    expect(input.startsAt).toBe(NOW.toISOString());
  });
});
