import { describe, expect, it } from 'vitest';
import { menuTabs, SKLUB_TAB } from '../menuTabs';
import { venueRowToPin } from '../../api/venues';
import { SKLUB_VENUE_ROW } from '../../test/fixtures/sklubVenueRow';
import type { OutletDayMenu } from '../menuForDay';
import type { SocietyPin } from '../../types/campusMap';

const outlet = (name: string): OutletDayMenu => ({ outlet: name, soup: null, mainDishes: ['x'] });
// SKM's page order, which is not the order reIS shows.
const SKM = [outlet('X'), outlet('KA'), outlet('JAK')];
const SKLUB = venueRowToPin(SKLUB_VENUE_ROW)!;
const MONDAY = '2026-11-09';
const SATURDAY = '2026-11-14';

const keys = (
  outlets: OutletDayMenu[],
  faculty: string | null,
  venuePins: SocietyPin[] = [SKLUB],
  dayIso = MONDAY
) => menuTabs(outlets, { faculty, venuePins, dayIso }).map((t) => t.key);

/**
 * The tab order is reIS's, not SKM's page order — Dominik, 1 November 2026.
 * Everyone sees X, JAK, KA, then S-klub (Dominik, 11 November 2026: every
 * student gets the S-klub tab, last). FRRMS students see their own building
 * first: KA (budova Z's výdejna), then S-klub (the café in budova Z), then X
 * and JAK. A student whose faculty is not known yet counts as everyone.
 */
describe('menuTabs', () => {
  it('everyone: X, JAK, KA, then S-klub last', () => {
    expect(keys(SKM, 'PEF')).toEqual(['X', 'JAK', 'KA', SKLUB_TAB]);
  });

  it('unknown faculty is everyone', () => {
    expect(keys(SKM, null)).toEqual(['X', 'JAK', 'KA', SKLUB_TAB]);
    expect(keys(SKM, '')).toEqual(['X', 'JAK', 'KA', SKLUB_TAB]);
  });

  it('everyone: no S-klub tab without the venue or on a day it does not open', () => {
    expect(keys(SKM, 'PEF', [])).toEqual(['X', 'JAK', 'KA']);
    expect(keys(SKM, 'PEF', [SKLUB], SATURDAY)).toEqual(['X', 'JAK', 'KA']);
  });

  it('FRRMS: KA, S-klub, X, JAK', () => {
    expect(keys(SKM, 'FRRMS')).toEqual(['KA', SKLUB_TAB, 'X', 'JAK']);
  });

  it('reads the faculty label loosely (case, whitespace)', () => {
    expect(keys(SKM, ' frrms ')).toEqual(['KA', SKLUB_TAB, 'X', 'JAK']);
  });

  it('a canteen that does not serve that day drops out; the rest keep their order', () => {
    expect(keys([outlet('JAK'), outlet('X')], 'FRRMS')).toEqual([SKLUB_TAB, 'X', 'JAK']);
    expect(keys([outlet('KA'), outlet('JAK')], 'PEF')).toEqual(['JAK', 'KA', SKLUB_TAB]);
  });

  it('no S-klub tab before the release creates the venues table', () => {
    expect(keys(SKM, 'FRRMS', [])).toEqual(['KA', 'X', 'JAK']);
  });

  it('no S-klub tab from another venue', () => {
    const other = { ...SKLUB, id: 'venue:other' };
    expect(keys(SKM, 'FRRMS', [other])).toEqual(['KA', 'X', 'JAK']);
  });

  it('no S-klub tab on a day the café does not open', () => {
    expect(keys(SKM, 'FRRMS', [SKLUB], SATURDAY)).toEqual(['KA', 'X', 'JAK']);
  });

  it('no S-klub tab on a day inside its closure', () => {
    const closed = {
      ...SKLUB,
      venue: { ...SKLUB.venue!, closure: { from: '2026-11-09', until: '2026-11-10' } },
    };
    expect(keys(SKM, 'FRRMS', [closed])).toEqual(['KA', 'X', 'JAK']);
    expect(keys(SKM, 'FRRMS', [closed], '2026-11-11')).toEqual(['KA', SKLUB_TAB, 'X', 'JAK']);
  });

  it('S-klub alone when no canteen serves but the café opens', () => {
    expect(keys([], 'FRRMS')).toEqual([SKLUB_TAB]);
  });

  it('a canteen reIS does not know yet goes last, in SKM order', () => {
    expect(keys([outlet('Nová'), ...SKM], 'PEF')).toEqual(['X', 'JAK', 'KA', SKLUB_TAB, 'Nová']);
  });

  it('carries the outlet menu and the venue through', () => {
    const tabs = menuTabs(SKM, { faculty: 'FRRMS', venuePins: [SKLUB], dayIso: MONDAY });
    expect(tabs[0]).toEqual({ kind: 'outlet', key: 'KA', menu: SKM[1] });
    expect(tabs[1]).toEqual({ kind: 'venue', key: SKLUB_TAB, pin: SKLUB, venue: SKLUB.venue });
  });
});
