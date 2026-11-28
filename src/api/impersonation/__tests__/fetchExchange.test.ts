import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));

import { fetchImpersonation } from '../fetchImpersonation';
import { loadOptions } from '../options';
import { route, resetShapes, SEPT, erasmusSelection, EXCHANGE_COURSES } from './isRoute';

/** The Erasmus persona (design 2026-11-27 §4, step C): pinned courses, no plan. */
beforeEach(() => {
  resetShapes();
  fetchWithAuth.mockReset();
  fetchWithAuth.mockImplementation(
    async (url: string, init?: RequestInit) => new Response(route(url, init))
  );
});

const bodies = () =>
  fetchWithAuth.mock.calls.map(([, init]) => new URLSearchParams(String(init?.body ?? '')));

describe('loadOptions keeps the timetable course select', () => {
  it("lists each faculty's courses by code, with its id and rozvrh", async () => {
    const pef = (await loadOptions(SEPT)).find((f) => f.faculty === 'PEF')!;
    expect(pef.courses).toContainEqual(
      expect.objectContaining({ code: 'EBA-MAR', predmetId: '164024', name: 'Marketing 1 v AJ' })
    );
    expect(pef.courses?.find((c) => c.code === 'EBC-FT')?.rozvrh.id).toBe(
      pef.programmes[0]!.rozvrh.id
    );
    // "-- všechny předměty --" is not a course.
    expect(pef.courses?.some((c) => c.predmetId === '0')).toBe(false);
  });
});

describe('fetchImpersonation, Erasmus', () => {
  it('each pinned course: its subject, a lecture and its FIRST seminar parallel', async () => {
    const r = await fetchImpersonation(await erasmusSelection(), SEPT);
    const codes = Object.values(EXCHANGE_COURSES);
    expect(Object.keys(r.subjects.data).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      const own = r.schedule.filter((l) => l.courseCode === code);
      expect(own.some((l) => l.isSeminar === 'false')).toBe(true);
      // Two seminar parallels in IS (09:00 and 13:00): the student is in one.
      const seminarTimes = new Set(
        own.filter((l) => l.isSeminar === 'true').map((l) => l.startTime)
      );
      expect([...seminarTimes]).toEqual(['09:00']);
    }
    expect(r.subjects.data['EBA-MAR']).toMatchObject({
      subjectCode: 'EBA-MAR',
      nameEn: 'Financial Markets',
      subjectId: '164024',
    });
  });

  it('asks each course without a year (exchange students have none), one per course', async () => {
    await fetchImpersonation(await erasmusSelection(), SEPT);
    const asked = bodies().filter((b) => b.get('predmet') && b.get('predmet') !== '0');
    // cz + en per course.
    expect(asked).toHaveLength(2 * Object.keys(EXCHANGE_COURSES).length);
    expect(asked.every((b) => b.get('rocnik') === '0' && b.get('program') === '0')).toBe(true);
  });

  it('has no study plan and asks the catalogue nothing', async () => {
    const r = await fetchImpersonation(await erasmusSelection(), SEPT);
    expect(r.plan).toBeNull();
    const urls = fetchWithAuth.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes('plany.pl'))).toBe(false);
    expect(r.resolved).toMatchObject({ shortCode: 'Z-EXC' });
  });

  it('fails whole on a failed answer, as the programme personas do', async () => {
    fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      const b = new URLSearchParams(String(init?.body ?? ''));
      return new Response(b.get('predmet') === '164120' ? '<html>error</html>' : route(url, init));
    });
    await expect(fetchImpersonation(await erasmusSelection(), SEPT)).rejects.toMatchObject({
      code: 'timetable',
    });
  });

  it('no course at all is noPlan', async () => {
    const sel = { ...(await erasmusSelection()), courses: [] };
    await expect(fetchImpersonation(sel, SEPT)).rejects.toMatchObject({ code: 'noPlan' });
  });
});
