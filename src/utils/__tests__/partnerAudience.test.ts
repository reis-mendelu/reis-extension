import { describe, it, expect } from 'vitest';
import type { Society } from '../../types/events';
import {
  AUDIENCE_TOKEN_RE,
  audienceFromDraft,
  baseProgramme,
  draftFromAudience,
  isPartner,
  matchesAudience,
  matchingPartners,
} from '../partnerAudience';

/**
 * Who a partner company is shown to (spec 2026-10-09): a faculty, or programmes
 * inside one, decided on the student's device.
 */
const partner = (id: string, audience: string[], sortOrder = 1, isActive = true): Society => ({
  id,
  name: id,
  shortName: id,
  color: '#000000',
  glyph: id,
  facultyKey: 'pef',
  autoFollowFaculty: false,
  audienceLabel: null,
  sortOrder,
  isActive,
  kind: 'partner',
  audience,
});

describe('baseProgramme', () => {
  it.each([
    ['B-OI', 'B-OI'],
    ['B-OI-ZBOI', 'B-OI'],
    ['b-aii', 'B-AII'],
    [' N-EM-FR ', 'N-EM'],
    ['OI', null],
    ['', null],
    [null, null],
    [undefined, null],
    ['B-!!', null],
  ])('%s → %s', (input, expected) => {
    expect(baseProgramme(input)).toBe(expected);
  });
});

describe('AUDIENCE_TOKEN_RE (must equal the SQL CHECK)', () => {
  it.each(['pef', 'mendelu', 'frrms', 'pef:B-OI', 'ldf:B-SBD', 'af:N-Z10'])('accepts %s', (t) => {
    expect(AUDIENCE_TOKEN_RE.test(t)).toBe(true);
  });
  it.each(['PEF', 'pef:b-oi', 'pef:', 'xyz', 'pef:B-', 'pef:BOI', 'pef:B-OI-ZBOI'])(
    'rejects %s',
    (t) => {
      expect(AUDIENCE_TOKEN_RE.test(t)).toBe(false);
    }
  );
});

describe('matchesAudience', () => {
  const pefOi = { facultyKey: 'pef' as const, programme: 'B-OI' };
  const pefEm = { facultyKey: 'pef' as const, programme: 'B-EM' };
  const pefUnknownProg = { facultyKey: 'pef' as const, programme: null };
  const frrms = { facultyKey: 'frrms' as const, programme: 'B-RR' };
  const nobody = { facultyKey: null, programme: null };

  it('a faculty token matches every programme of that faculty', () => {
    expect(matchesAudience(['pef'], pefEm)).toBe(true);
    expect(matchesAudience(['pef'], pefUnknownProg)).toBe(true);
    expect(matchesAudience(['pef'], frrms)).toBe(false);
  });
  it('a programme token matches only that programme of that faculty', () => {
    expect(matchesAudience(['pef:B-OI'], pefOi)).toBe(true);
    expect(matchesAudience(['pef:B-OI'], pefEm)).toBe(false);
    expect(matchesAudience(['pef:B-OI'], pefUnknownProg)).toBe(false);
    expect(matchesAudience(['frrms:B-OI'], pefOi)).toBe(false);
  });
  it('mendelu matches every student whose faculty is known', () => {
    expect(matchesAudience(['mendelu'], frrms)).toBe(true);
    expect(matchesAudience(['mendelu'], nobody)).toBe(false);
  });
  it('any matching token is enough', () => {
    expect(matchesAudience(['frrms', 'pef:B-OI'], pefOi)).toBe(true);
  });
  it('no audience or an unknown faculty matches nothing', () => {
    expect(matchesAudience(null, pefOi)).toBe(false);
    expect(matchesAudience([], pefOi)).toBe(false);
    expect(matchesAudience(['pef'], nobody)).toBe(false);
  });
});

describe('isPartner / matchingPartners', () => {
  it('only kind partner is a partner', () => {
    expect(isPartner(partner('ey', ['pef']))).toBe(true);
    expect(isPartner({ ...partner('esn', ['pef']), kind: 'society' })).toBe(false);
    expect(isPartner(undefined)).toBe(false);
  });
  it('lists active matching partners in sort order', () => {
    const cat = {
      b: partner('b', ['pef'], 20),
      a: partner('a', ['pef:B-OI'], 10),
      c: partner('c', ['frrms'], 5),
      d: partner('d', ['pef'], 1, false),
      s: { ...partner('s', ['pef'], 0), kind: 'society' as const },
    };
    expect(
      matchingPartners(cat, { facultyKey: 'pef', programme: 'B-OI' }).map((p) => p.id)
    ).toEqual(['a', 'b']);
  });
});

describe('audience draft round trip', () => {
  it('chips and programme lists become tokens', () => {
    expect(audienceFromDraft({ frrms: '', pef: 'b-oi, N-OI  B-AII' })).toEqual([
      'frrms',
      'pef:B-OI',
      'pef:N-OI',
      'pef:B-AII',
    ]);
  });
  it('an empty draft or a bad code is invalid', () => {
    expect(audienceFromDraft({})).toBe('invalid');
    expect(audienceFromDraft({ pef: 'B_OI' })).toBe('invalid');
  });
  it('tokens become a draft', () => {
    expect(draftFromAudience(['frrms', 'pef:B-OI', 'pef:N-OI'])).toEqual({
      frrms: '',
      pef: 'B-OI, N-OI',
    });
    expect(draftFromAudience(null)).toEqual({});
  });
});
