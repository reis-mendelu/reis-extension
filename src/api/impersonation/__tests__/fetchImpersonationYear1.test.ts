import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));

import { fetchImpersonation } from '../fetchImpersonation';
import { route, resetShapes, shapes, raw, SEPT, bfSelection } from './isRoute';

/**
 * The first-year shapes the live persona check found (2026-11-27): lectures IS
 * tags to no programme (AF), subjects the plan omits (ZF B-RASZ), seminar
 * parallels with no group (ZF ZABAH).
 */
beforeEach(() => {
  resetShapes();
  fetchWithAuth.mockReset();
  fetchWithAuth.mockImplementation(
    async (url: string, init?: RequestInit) => new Response(route(url, init))
  );
});

describe('fetchImpersonation, year 1 shapes', () => {
  it('year 1: a subject that came back with seminars only gets its lectures on their own', async () => {
    shapes.mtLecturesUntagged = true;
    const r = await fetchImpersonation(await bfSelection(1), SEPT);
    const mt = r.schedule.filter((l) => l.courseCode === 'EBC-MT');
    expect(mt.some((l) => l.isSeminar === 'false')).toBe(true);
    // The group's own seminar stays; the per-subject answer adds lectures only.
    const groupSeminars = JSON.parse(raw('rozvrh-bf-y1-g2.cz.json')).blockLessons.filter(
      (l: { courseCode: string; isSeminar: string }) =>
        l.courseCode === 'EBC-MT' && l.isSeminar === 'true'
    ).length;
    expect(mt.filter((l) => l.isSeminar === 'true')).toHaveLength(groupSeminars);
  });

  it('year 1: a subject the group is taught but the plan omits joins the subjects', async () => {
    shapes.botazTaught = true;
    const r = await fetchImpersonation(await bfSelection(1), SEPT);
    expect(r.subjects.data['BOTAZ']).toMatchObject({
      subjectCode: 'BOTAZ',
      nameCs: 'Botanika',
      subjectId: '170001',
    });
    for (const l of r.schedule) expect(r.subjects.data[l.courseCode]).toBeDefined();
    // The plan screen stays what IS's catalogue says.
    const planCodes = r.plan.cz.blocks.flatMap((b) =>
      b.groups.flatMap((g) => g.subjects.map((x) => x.code))
    );
    expect(planCodes).not.toContain('BOTAZ');
  });

  it('year 1: untagged seminar parallels keep one for a group, all of them for "All groups"', async () => {
    shapes.parallelsUntagged = true;
    const slots = (r: { schedule: { courseCode: string; date: string; startTime: string }[] }) =>
      r.schedule.filter((l) => l.courseCode === 'ZABAH').map((l) => `${l.date} ${l.startTime}`);
    const one = await fetchImpersonation(await bfSelection(1), SEPT);
    expect(slots(one)).toEqual(['20260929 09:00', '20261013 09:00']);
    const all = await fetchImpersonation({ ...(await bfSelection(1)), group: null }, SEPT);
    expect(slots(all)).toHaveLength(4);
  });

  it('year 1: a subject with lectures in the group answer is not asked again', async () => {
    await fetchImpersonation(await bfSelection(1), SEPT);
    const asked = fetchWithAuth.mock.calls
      .map(([, init]) => new URLSearchParams(String(init?.body ?? '')))
      .filter((b) => b.get('predmet') === '157993');
    expect(asked).toHaveLength(0);
  });
});
