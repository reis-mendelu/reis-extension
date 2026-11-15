import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppView } from '../../types/app';
import type { MobileSheet, MobileTab } from '../../store/types';
import {
  CAPABILITIES,
  type DesktopCapabilityId,
  type MobileCapabilityId,
  type Placement,
} from '../capabilities';
import {
  DESKTOP_VIEW_CAPABILITY,
  PHONE_SHEET_CAPABILITY,
  PHONE_TAB_CAPABILITY,
  type Unrendered,
} from '../surfaces';

/**
 * The registry's promise is made by `tsc`, not by vitest: vitest strips types,
 * so each `@ts-expect-error` below is checked by `npm run typecheck` (tsconfig
 * includes all of `src`). If one of them stops erroring, the directive itself
 * becomes the error, and the mechanism it proves has gone quiet.
 *
 * The coverage rule is spelled out here, not imported from `surfaces.ts`: if
 * that file's `satisfies` were loosened (say, to `Record<string, …>`), these
 * assignments would still demand every real sheet kind, tab and view.
 */
type SheetsCovered = Record<MobileSheet['kind'], MobileCapabilityId | Unrendered>;
type TabsCovered = Record<MobileTab, MobileCapabilityId>;
type ViewsCovered = Record<AppView, DesktopCapabilityId | Unrendered>;

describe('a surface on one tree only does not compile', () => {
  it('each map covers its whole union, whatever surfaces.ts declares', () => {
    const sheets: SheetsCovered = PHONE_SHEET_CAPABILITY;
    const tabs: TabsCovered = PHONE_TAB_CAPABILITY;
    const views: ViewsCovered = DESKTOP_VIEW_CAPABILITY;
    expect([sheets, tabs, views]).toHaveLength(3);
  });

  it('a real sheet kind left out of the map does not compile', () => {
    const without: Omit<typeof PHONE_SHEET_CAPABILITY, 'hideLesson'> = PHONE_SHEET_CAPABILITY;
    // @ts-expect-error — hideLesson is a real sheet kind, now with no capability
    const sheets: SheetsCovered = without;
    expect(sheets).toBe(PHONE_SHEET_CAPABILITY);
  });

  it('a real phone tab left out of the map does not compile', () => {
    const without: Omit<typeof PHONE_TAB_CAPABILITY, 'profile'> = PHONE_TAB_CAPABILITY;
    // @ts-expect-error — profile is a real tab, now with no capability
    const tabs: TabsCovered = without;
    expect(tabs).toBe(PHONE_TAB_CAPABILITY);
  });

  it('a real desktop view left out of the map does not compile', () => {
    const without: Omit<typeof DESKTOP_VIEW_CAPABILITY, 'erasmus'> = DESKTOP_VIEW_CAPABILITY;
    // @ts-expect-error — erasmus is a real view, now with no capability
    const views: ViewsCovered = without;
    expect(views).toBe(DESKTOP_VIEW_CAPABILITY);
  });

  it('a capability must fill both slots', () => {
    // @ts-expect-error — the mobile slot is missing
    const halfDecided: Placement = { desktop: 'present' };
    expect(halfDecided).toBeDefined();
  });

  it('a surface cannot name a capability its own tree omits', () => {
    // @ts-expect-error — Erasmus is omitted on the phone, so no sheet can be it
    const erasmusSheet: MobileCapabilityId = 'erasmus';
    // @ts-expect-error — ISIC is omitted on the desktop, so no view can be it
    const isicView: DesktopCapabilityId = 'isic';
    expect([erasmusSheet, isicView]).toHaveLength(2);
  });
});

const reasons = (): string[] => [
  ...Object.values(CAPABILITIES).flatMap((p: Placement) =>
    [p.desktop, p.mobile].flatMap((s) => (s === 'present' ? [] : [s.omitted]))
  ),
  ...[PHONE_SHEET_CAPABILITY, PHONE_TAB_CAPABILITY, DESKTOP_VIEW_CAPABILITY].flatMap((map) =>
    Object.values(map).flatMap((v) => (typeof v === 'string' ? [] : [v.unrendered]))
  ),
];

describe('the registry', () => {
  it('every omission and every unrendered key says why', () => {
    for (const reason of reasons()) expect(reason.trim().length).toBeGreaterThan(20);
  });

  it('no capability is omitted on both trees', () => {
    for (const [id, p] of Object.entries(CAPABILITIES) as [string, Placement][]) {
      expect({ id, onSomeTree: p.desktop === 'present' || p.mobile === 'present' }).toEqual({
        id,
        onSomeTree: true,
      });
    }
  });

  // The open questions for Dominik. Settling one changes this list on purpose.
  it('pins the undecided cases', () => {
    const undecided = reasons().filter((r) => r.startsWith('undecided:'));
    expect(undecided).toHaveLength(3);
    expect(CAPABILITIES.personPhoto.desktop).toMatchObject({
      omitted: expect.stringMatching(/^undecided:/),
    });
    expect(DESKTOP_VIEW_CAPABILITY.settings).toMatchObject({
      unrendered: expect.stringMatching(/^undecided:/),
    });
    expect(DESKTOP_VIEW_CAPABILITY['timeline-demo']).toMatchObject({
      unrendered: expect.stringMatching(/^undecided:/),
    });
  });

  it('only the known keys escape as unrendered', () => {
    const unrendered = [PHONE_SHEET_CAPABILITY, DESKTOP_VIEW_CAPABILITY].flatMap((map) =>
      Object.entries(map).flatMap(([k, v]) => (typeof v === 'string' ? [] : [k]))
    );
    expect(unrendered.sort()).toEqual(['confirm', 'settings', 'timeline-demo']);
  });

  // An app import would put the registry in a tree's import closure, which
  // tree-parity.mjs and contentScriptGraph.test.ts both compute.
  it.each(['capabilities.ts', 'surfaces.ts'])('features/%s imports types only', (file) => {
    const src = readFileSync(resolve(process.cwd(), 'src/features', file), 'utf8');
    const imports = src.split('\n').filter((l) => /^import\s/.test(l));
    for (const line of imports) expect(line).toMatch(/^import type /);
  });
});
