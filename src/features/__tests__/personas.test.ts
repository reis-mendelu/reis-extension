import { describe, it, expect, vi } from 'vitest';
import { PERSONAS, resolvePersona, personaRequest } from '../personas';
import type { FacultyOptions, ProgrammeOption, RozvrhRef } from '../../api/impersonation/types';

const rozvrh = (faculty: string): RozvrhRef => ({
  id: `r-${faculty}`,
  z: '20260921',
  k: '20261213',
  label: '',
  period: 'ZS 2026/2027',
  faculty,
  form: 'prezenční',
  start: '21.09.2026',
  end: '20.12.2026',
});

/** One programme entry the way `loadOptions` builds it (made-up ids). */
function programme(faculty: string, name: string, ...codes: string[]): ProgrammeOption {
  const variants = codes.map((shortCode, i) => ({
    programId: `${faculty}-${i}-${shortCode}`,
    shortCode,
    rozvrh: rozvrh(faculty),
  }));
  const first = variants[0]!;
  return { ...first, name, faculty, years: [1, 2, 3], variants };
}

/**
 * Trimmed `loadOptions()`. ZF's entry is two IS versions merged by
 * `mergeVersions`, and the OUTGOING code comes first: the top-level shortCode
 * reads B-RSZ while the persona asks for B-RASZ. A resolver that only looked at
 * the top level would miss it.
 */
const OPTIONS: FacultyOptions[] = [
  {
    faculty: 'PEF',
    programmes: [
      programme('PEF', 'Otevřená informatika', 'B-OI'),
      programme('PEF', 'Finance', 'B-F'),
      programme('PEF', 'Finance', 'N-F'),
      programme('PEF', 'Ekonomika a management', 'B-EAM', 'B-EM'),
    ],
  },
  {
    faculty: 'FRRMS',
    programmes: [programme('FRRMS', 'Mezinárodní teritoriální studia', 'B-METS')],
  },
  { faculty: 'AF', programmes: [programme('AF', 'Zemědělské inženýrství', 'B-ZIN')] },
  { faculty: 'LDF', programmes: [programme('LDF', 'Stavby na bázi dřeva', 'B-SNBD')] },
  { faculty: 'ZF', programmes: [programme('ZF', 'Realizace a správa zeleně', 'B-RSZ', 'B-RASZ')] },
];

describe('PERSONAS', () => {
  it('is the seven programme personas of decision #1, all first year', () => {
    expect(PERSONAS.map((p) => p.shortCode)).toEqual([
      'B-OI',
      'B-F',
      'B-EM',
      'B-METS',
      'B-ZIN',
      'B-SNBD',
      'B-RASZ',
    ]);
    expect(PERSONAS.every((p) => p.year === 1)).toBe(true);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(PERSONAS.length);
  });

  it('lists no Erasmus persona yet (step C)', () => {
    expect(PERSONAS.some((p) => p.erasmus || p.language)).toBe(false);
  });
});

describe('resolvePersona', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))('%s resolves against loadOptions', (_, p) => {
    const hit = resolvePersona(p, OPTIONS);
    expect(hit?.faculty).toBe(p.faculty);
    expect(hit?.variants.map((v) => v.shortCode)).toContain(p.shortCode);
  });

  it('finds B-RASZ inside the merged B-RSZ entry', () => {
    const zf = PERSONAS.find((p) => p.shortCode === 'B-RASZ')!;
    expect(resolvePersona(zf, OPTIONS)?.shortCode).toBe('B-RSZ');
  });

  it('reads the faculty: a code at another faculty does not match', () => {
    const it_ = PERSONAS.find((p) => p.id === 'it')!;
    expect(resolvePersona({ ...it_, faculty: 'AF' }, OPTIONS)).toBeNull();
  });

  it('is null for an unknown code and for a persona with no programme', () => {
    const it_ = PERSONAS.find((p) => p.id === 'it')!;
    expect(resolvePersona({ ...it_, shortCode: 'B-XYZ' }, OPTIONS)).toBeNull();
    expect(resolvePersona({ ...it_, shortCode: null }, OPTIONS)).toBeNull();
  });
});

describe('personaRequest', () => {
  const finance = PERSONAS.find((p) => p.id === 'finance')!;

  it('takes the FIRST group IS lists, not a literal 1', async () => {
    const groups = vi.fn(async () => [3, 5]);
    const req = await personaRequest(finance, OPTIONS, groups);
    expect(req).toMatchObject({ shortCode: 'B-F', faculty: 'PEF', year: 1, group: 3 });
    expect(req.personaId).toBe('finance');
    expect(req.variants?.map((v) => v.shortCode)).toEqual(['B-F']);
  });

  it('asks for every group (null) when IS lists none', async () => {
    const req = await personaRequest(finance, OPTIONS, async () => []);
    expect(req.group).toBeNull();
  });

  it('fails with noPlan for a code IS no longer lists', async () => {
    await expect(
      personaRequest({ ...finance, shortCode: 'B-GONE' }, OPTIONS, async () => [1])
    ).rejects.toMatchObject({ code: 'noPlan' });
  });
});
