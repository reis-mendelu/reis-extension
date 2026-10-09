import { describe, it, expect } from 'vitest';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import {
  audienceOf,
  canSee,
  visibleToStudent,
  audienceLabelKey,
  type Viewer,
} from '../eventAudience';

/**
 * Who a society event is for (spec 2026-10-08). The audience is decided from
 * who the student IS — faculty, Erasmus — never from a list they keep. The
 * fetch is anonymous, so this is noise control, not access control: these
 * tests are about what a student is shown.
 */
const cat = BUNDLED_SOCIETIES;
const pef: Viewer = { facultyKey: 'pef', erasmus: false };
const frrms: Viewer = { facultyKey: 'frrms', erasmus: false };
const erasmusPef: Viewer = { facultyKey: 'pef', erasmus: true };
const unknown: Viewer = { facultyKey: null, erasmus: false };
const ev = (societyId: string, subscribersOnly?: boolean) => ({ societyId, subscribersOnly });

describe('audienceOf', () => {
  it.each([
    ['supef', 'pef'],
    ['ey', 'pef'],
    ['au_frrms', 'frrms'],
    ['usaf', 'af'],
    ['ldf', 'ldf'],
    ['zf', 'zf'],
    ['esn', 'erasmus'],
    ['reis', 'everyone'],
  ])('%s → %s', (id, expected) => {
    expect(audienceOf(cat[id])).toBe(expected);
  });

  it('an unknown society has no audience of its own', () => {
    expect(audienceOf(undefined)).toBe('everyone');
  });
});

describe('canSee', () => {
  it('public events are for everyone', () => {
    expect(canSee(ev('esn', false), cat, frrms)).toBe(true);
    expect(canSee(ev('supef'), cat, unknown)).toBe(true);
  });

  it('a faculty society restricts to its faculty, strictly', () => {
    expect(canSee(ev('supef', true), cat, pef)).toBe(true);
    expect(canSee(ev('supef', true), cat, frrms)).toBe(false);
    expect(canSee(ev('ey', true), cat, pef)).toBe(true);
  });

  it('ESN restricts to Erasmus students', () => {
    expect(canSee(ev('esn', true), cat, pef)).toBe(false);
    expect(canSee(ev('esn', true), cat, erasmusPef)).toBe(true);
  });

  it('an Erasmus student also belongs to their faculty', () => {
    expect(canSee(ev('supef', true), cat, erasmusPef)).toBe(true);
  });

  it('reIS cannot be restricted', () => {
    expect(canSee(ev('reis', true), cat, unknown)).toBe(true);
  });

  it('an unknown faculty sees public events only', () => {
    expect(canSee(ev('supef', true), cat, unknown)).toBe(false);
  });

  it('a restricted event of a society missing from the catalog is hidden', () => {
    expect(canSee(ev('ghost', true), cat, pef)).toBe(false);
  });
});

describe('canSee: partners obey their audience, whatever subscribersOnly says', () => {
  const sap = { ...cat.ey!, id: 'sap', kind: 'partner' as const, audience: ['pef:B-OI', 'pef:B-AII'] };
  const withSap = { ...cat, sap };
  const pefOi: Viewer = { facultyKey: 'pef', erasmus: false, programme: 'B-OI' };
  const pefEm: Viewer = { facultyKey: 'pef', erasmus: false, programme: 'B-EM' };

  it('shows a public partner event only to matching students', () => {
    expect(canSee(ev('sap', false), withSap, pefOi)).toBe(true);
    expect(canSee(ev('sap', false), withSap, pefEm)).toBe(false);
    expect(canSee(ev('sap', false), withSap, frrms)).toBe(false);
    expect(canSee(ev('sap', false), withSap, unknown)).toBe(false);
  });
  it('a restricted partner event follows the same audience', () => {
    expect(canSee(ev('sap', true), withSap, pefOi)).toBe(true);
    expect(canSee(ev('sap', true), withSap, pefEm)).toBe(false);
  });
  it('EY, a PEF-wide partner, is hidden from other faculties even on a public event', () => {
    expect(canSee(ev('ey', false), cat, pef)).toBe(true);
    expect(canSee(ev('ey', false), cat, frrms)).toBe(false);
  });
  it('societies keep their faculty rule', () => {
    expect(canSee(ev('supef', false), withSap, frrms)).toBe(true);
    expect(canSee(ev('supef', true), withSap, frrms)).toBe(false);
  });
});

describe('visibleToStudent', () => {
  it('keeps order and drops what the viewer may not see', () => {
    const list = [ev('supef', true), ev('esn', true), ev('reis')];
    expect(visibleToStudent(list, cat, pef)).toEqual([list[0], list[2]]);
  });
});

describe('audienceLabelKey', () => {
  it('names the faculty, EY included', () => {
    expect(audienceLabelKey(cat.ey)).toEqual({ key: 'admin.audience.faculty', faculty: 'PEF' });
  });

  it('names Erasmus for ESN', () => {
    expect(audienceLabelKey(cat.esn)).toEqual({ key: 'admin.audience.erasmus' });
  });

  it('reIS has nothing to restrict to', () => {
    expect(audienceLabelKey(cat.reis)).toBeNull();
  });
});
