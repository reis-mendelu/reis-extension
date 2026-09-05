import { describe, it, expect } from 'vitest';
import { mapAppOptions } from '../mapAppOptions';

/**
 * The Profil row that shows which map app a venue tap will open.
 *
 * Reported as "clicking anywhere on 'mapy' row in the settings makes it
 * disappear": the whole row was one `<button>` whose `onClick` cleared the
 * preference, and the row's own render condition was `{preferredMapApp && …}`.
 * So the row was a control that deleted the reason it was on screen — a tap
 * anywhere on it, including on the label, unmounted it with no way back.
 *
 * The state of that row is decided here instead, so "is there a row, and which
 * option is on" is one testable question rather than a condition spread across
 * the screen.
 */
describe('mapAppOptions', () => {
  // Android's `geo:` IS the chooser — `resolveVenueChoice` never asks there, so
  // a stored preference could never be consulted. A settings row for it would
  // be a control with no effect, which is worse than no row.
  it('offers nothing on Android, where the system already asks', () => {
    expect(mapAppOptions('android', null)).toEqual([]);
  });

  // Same reasoning for a browser: one Google URL, nothing to choose between.
  it('offers nothing on the web', () => {
    expect(mapAppOptions('web', null)).toEqual([]);
  });

  // iOS has no system chooser, so this is the only place the choice exists.
  it('offers Apple, Google and "ask" on iOS', () => {
    expect(mapAppOptions('ios', null).map((o) => o.id)).toEqual(['apple', 'google', 'ask']);
  });

  // The bug that started this: `null` is a real, selectable state — "ask me
  // every time" — not the absence of a row.
  it('selects "ask" when nothing is remembered', () => {
    const selected = mapAppOptions('ios', null).filter((o) => o.selected);
    expect(selected.map((o) => o.id)).toEqual(['ask']);
  });

  it('selects the remembered app', () => {
    expect(mapAppOptions('ios', 'google').find((o) => o.selected)!.id).toBe('google');
    expect(mapAppOptions('ios', 'apple').find((o) => o.selected)!.id).toBe('apple');
  });

  // Exactly one option is on, always. A segmented control with nothing lit
  // says the setting has no value, and this one always has one.
  it('lights exactly one option, whatever is stored', () => {
    for (const stored of [null, 'apple', 'google', 'waze' as never] as const) {
      expect(mapAppOptions('ios', stored).filter((o) => o.selected)).toHaveLength(1);
    }
  });

  // A value left by an older build, or edited by hand, must not light nothing.
  // `resolveVenueChoice` already treats an unrecognised preference as "ask";
  // the row has to agree with it, or it would claim a choice the tap ignores.
  it('falls back to "ask" for a value it does not recognise, like the opener does', () => {
    expect(mapAppOptions('ios', 'waze' as never).find((o) => o.selected)!.id).toBe('ask');
  });

  it('names each option with an i18n key, never a literal', () => {
    for (const o of mapAppOptions('ios', null)) {
      expect(o.labelKey).toMatch(/^map\./);
    }
  });
});
