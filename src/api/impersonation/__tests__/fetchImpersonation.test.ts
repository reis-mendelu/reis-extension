import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));

import { fetchImpersonation } from '../fetchImpersonation';
import { loadOptions, loadYear1Groups } from '../options';
import { route, resetShapes, SEPT, bfSelection } from './isRoute';

beforeEach(() => {
  resetShapes();
  fetchWithAuth.mockReset();
  fetchWithAuth.mockImplementation(
    async (url: string, init?: RequestInit) => new Response(route(url, init))
  );
});

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
    const asked = perSubject.filter((b) => b.get('lang') === 'cz' && b.get('rocnik') === '1');
    // EBC-KOM (158216), missing; and EBA-AJ1 (158903), seminars only, asked for
    // lectures it turns out not to have.
    expect(asked.map((b) => b.get('predmet')).sort()).toEqual(['158216', '158903']);
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
