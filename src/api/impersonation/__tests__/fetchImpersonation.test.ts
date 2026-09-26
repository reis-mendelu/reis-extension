import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const FX = 'src/api/impersonation/__tests__/fixtures/';
const raw = (n: string) => readFileSync(resolve(process.cwd(), FX + n), 'utf8');
const noResults = readFileSync(
  resolve(process.cwd(), 'src/api/__tests__/fixtures/is-rozvrh-no-results.html'),
  'utf8'
);

const fetchWithAuth = vi.fn();
vi.mock('../../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));

import { fetchImpersonation } from '../fetchImpersonation';
import { loadOptions, loadYear1Groups } from '../options';
import type { ImpersonationSelection } from '../types';

/** Answers each request with the real IS page that request got on 2026-09-26. */
function route(url: string, init?: RequestInit): string {
  const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
  if (url.includes('rozvrhy_view.pl?konf=1;lang=cz')) return raw('rozvrh-index.html');
  if (url.includes('rozvrhy_view.pl?konf=1;z=')) return raw('rozvrh-range.html');
  if (url.includes('rozvrhy_view.pl') && !body.has('format')) return raw('rozvrh-criteria.html');
  if (body.get('format') === 'list') return raw('rozvrh-list-bf-y1.html');
  if (
    body.get('format') === 'json' &&
    body.get('predmet') === '164066' &&
    body.get('rocnik') === '2'
  )
    return raw(`rozvrh-predmet-ft.${body.get('lang')}.json`);
  // EBC-AZD (162664) behaves like AF/FRRMS/ZF subjects live: nothing under
  // rocnik=2, a full timetable without the year filter (observed 2026-09-26).
  if (
    body.get('format') === 'json' &&
    body.get('predmet') === '162664' &&
    body.get('rocnik') === '0'
  )
    return raw(`rozvrh-predmet-ft.${body.get('lang')}.json`).replaceAll('EBC-FT', 'EBC-AZD');
  if (body.get('format') === 'json' && body.get('skupina') === '2')
    return raw(`rozvrh-bf-y1-g2.${body.get('lang')}.json`);
  if (body.get('format') === 'json') return noResults;
  if (url.includes('plany.pl?fakulta=2;lang=cz')) return raw('catalog-periods-pef.html');
  // An outgoing programme version: IS's own "no forms of study" page.
  if (url.includes('program=9999') && !url.includes('stud_plan'))
    return raw('catalog-programme-no-forms.html');
  if (url.includes('program=1889') && !url.includes('stud_plan'))
    return raw('catalog-programme-bf-801.auth.html');
  if (url.includes('stud_plan=12490') && url.includes('lang=en'))
    return raw('catalog-plan-bf-801.en.html');
  if (url.includes('stud_plan=12490')) return raw('catalog-plan-bf-801.cz.html');
  throw new Error(`unrouted ${url}`);
}

beforeEach(() => {
  fetchWithAuth.mockReset();
  fetchWithAuth.mockImplementation(
    async (url: string, init?: RequestInit) => new Response(route(url, init))
  );
});

const SEPT = new Date(2026, 8, 26);

async function bfSelection(year: number): Promise<ImpersonationSelection> {
  const bf = (await loadOptions(SEPT))
    .find((f) => f.faculty === 'PEF')!
    .programmes.find((p) => p.shortCode === 'B-F')!;
  return {
    variants: bf.variants,
    programId: bf.programId,
    shortCode: bf.shortCode,
    name: bf.name,
    faculty: 'PEF',
    year,
    group: year === 1 ? 2 : null,
    rozvrh: bf.rozvrh,
    periodLabel: 'ZS 2026/2027',
  };
}

describe('loadOptions', () => {
  it('lists prezenční programmes of the current rozvrhy, B-/N- only', async () => {
    const opts = await loadOptions(SEPT);
    const bf = opts
      .find((f) => f.faculty === 'PEF')!
      .programmes.find((p) => p.shortCode === 'B-F')!;
    expect(bf).toMatchObject({ programId: '1889', name: 'Finance', years: [1, 2, 3] });
    expect(bf.rozvrh.id).toBe('5769');
    expect(opts.every((f) => f.programmes.every((p) => /^[BN]-/.test(p.shortCode)))).toBe(true);
  });
  it('merges the versions of one programme into one entry (real PEF form: B-EAM 1892, B-EM 3066)', async () => {
    const pef = (await loadOptions(SEPT)).find((f) => f.faculty === 'PEF')!;
    const eam = pef.programmes.filter((p) => p.name === 'Ekonomika a management');
    expect(eam).toHaveLength(1);
    expect(eam[0]!.variants.map((v) => v.shortCode)).toEqual(['B-EAM', 'B-EM']);
    const bf = pef.programmes.find((p) => p.shortCode === 'B-F')!;
    expect(bf.variants.map((v) => v.programId)).toEqual(['1889']);
  });
  it('keeps same-named bachelor and master programmes apart', async () => {
    const pef = (await loadOptions(SEPT)).find((f) => f.faculty === 'PEF')!;
    expect(pef.programmes.filter((p) => p.name === 'Finance').map((p) => p.shortCode)).toEqual([
      'B-F',
      'N-F',
    ]);
  });
  it('fails as "options" when no validity range covers today', async () => {
    await expect(loadOptions(new Date(2027, 5, 1))).rejects.toMatchObject({ code: 'options' });
  });
});

describe('loadYear1Groups', () => {
  it('asks for groups in the list format', async () => {
    const bf = (await loadOptions(SEPT))
      .find((f) => f.faculty === 'PEF')!
      .programmes.find((p) => p.shortCode === 'B-F')!;
    await expect(loadYear1Groups(bf)).resolves.toEqual([1, 2, 3, 4, 5]);
  });
});

describe('fetchImpersonation', () => {
  it('year 1: intake 829 is not routed, but 801 plan is — uses the group query', async () => {
    // Year 1 in Sept 2026 → intake ZS 2026/2027 (poc 829). The router answers
    // every B-F programme page with the 801 one, which is fine for this test:
    // the point is that the timetable comes from program+rocnik+skupina.
    const r = await fetchImpersonation(await bfSelection(1), SEPT);
    expect(new Set(r.schedule.map((l) => l.courseCode))).toContain('EBC-MT');
    expect(r.schedule.every((l) => l.studyId === '' && l.courseNameEn)).toBe(true);
  });

  it('year 2: intake 801 plan, semester 3, per-subject first slots, both languages', async () => {
    const r = await fetchImpersonation(await bfSelection(2), SEPT);
    expect(r.plan.cz.blocks).toHaveLength(6);
    expect(r.plan.en.blocks).toHaveLength(6);
    const enrolled = r.plan.cz.blocks[2]!.groups.flatMap((g) => g.subjects).filter(
      (s) => s.isEnrolled
    );
    expect(enrolled.map((s) => s.code)).toContain('EBC-FT');
    // Only EBC-FT has a routed timetable; the rest answer no-results = no lessons, not failure.
    expect(new Set(r.schedule.map((l) => l.courseCode))).toEqual(new Set(['EBC-FT', 'EBC-AZD']));
    const ft = r.schedule.filter((l) => l.courseCode === 'EBC-FT');
    expect(ft).toHaveLength(24);
    expect(ft.every((l) => l.courseNameEn === 'Financial Markets' && l.studyId === '')).toBe(true);
    expect(Object.keys(r.subjects.data)).toContain('EBC-FT');
    expect(r.subjects.data['EBC-FT']!.nameEn).toBe('Financial Markets');
  });

  it('falls back to no year filter when rocnik finds nothing for a subject', async () => {
    const r = await fetchImpersonation(await bfSelection(2), SEPT);
    expect(r.schedule.filter((l) => l.courseCode === 'EBC-AZD')).toHaveLength(24);
    // EBC-FT answered under rocnik=2, so it is never asked again without it.
    const bodies = fetchWithAuth.mock.calls.map(
      ([, init]) => new URLSearchParams(String(init?.body ?? ''))
    );
    const ftNoYear = bodies.filter((b) => b.get('predmet') === '164066' && b.get('rocnik') === '0');
    expect(ftNoYear).toHaveLength(0);
  });

  it('year 1: a plan subject the programme query missed is fetched on its own', async () => {
    // The real first-week B-F group-2 answer has no EBC-KOM lesson.
    await fetchImpersonation(await bfSelection(1), SEPT);
    const perSubject = fetchWithAuth.mock.calls
      .map(([, init]) => new URLSearchParams(String(init?.body ?? '')))
      .filter((b) => b.get('format') === 'json' && b.get('predmet') !== '0');
    const kom = perSubject.filter((b) => b.get('lang') === 'cz' && b.get('rocnik') === '1');
    expect(kom.length).toBe(1);
  });

  it('uses the programme version that has a plan for the intake, and says which', async () => {
    // Real case: B-RSZ (years 2-3) and B-RASZ (year 1) are one programme in two
    // IS versions; only one has a plan for a given intake. 9999 answers with
    // IS's real "no forms of study" page.
    const sel = await bfSelection(2);
    const current = sel.variants ?? [];
    const outgoing = { ...current[0]!, programId: '9999', shortCode: 'B-OLD' };
    const r = await fetchImpersonation({ ...sel, variants: [outgoing, ...current] }, SEPT);
    expect(r.resolved).toMatchObject({ programId: '1889', shortCode: 'B-F' });
    expect(r.plan.cz.blocks).toHaveLength(6);
  });

  it('a failed timetable leg fails the whole fetch (never half-applied)', async () => {
    fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      if (body.get('format') === 'json' && body.get('lang') === 'en')
        return new Response('<html>login</html>');
      return new Response(route(url, init));
    });
    await expect(fetchImpersonation(await bfSelection(2), SEPT)).rejects.toMatchObject({
      code: 'timetable',
    });
  });

  it('a year beyond the plan fails as noSemester', async () => {
    // Year 4 → intake ZS 2023/2024 (poc 734, in the real period list); the
    // router answers with the 801 plan, which has no semester 7.
    await expect(fetchImpersonation(await bfSelection(4), SEPT)).rejects.toMatchObject({
      code: 'noSemester',
    });
  });

  it('an intake the catalogue does not list fails as noPlan', async () => {
    await expect(fetchImpersonation(await bfSelection(40), SEPT)).rejects.toMatchObject({
      code: 'noPlan',
    });
  });
});
