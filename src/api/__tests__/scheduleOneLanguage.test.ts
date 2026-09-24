import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A timetable read is every language it asked for, or it is a failure.
 *
 * The rule from #403, which fixed a Czech calendar randomly turning English:
 * the dual fetch fell back to whichever leg survived, so one flaky CZ request
 * made the raw English lessons the timetable. With single-language fetching a
 * Czech student asks for one leg only, and that leg failing must still be
 * `null` — "failed, keep what is cached" — never an empty or partial answer.
 */
const fetchWithAuth = vi.fn();
vi.mock('../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));
vi.mock('../user', () => ({ getUserId: async () => 'u1' }));
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => ({ studium: 'st1', obdobi: 'ob1' }),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchDualLanguageSchedule } from '../schedule';
import { localizedCourseName } from '../../utils/localizedLesson';

const RANGE = { start: new Date(2026, 8, 1), end: new Date(2027, 7, 31) };
const lesson = (courseName: string, room: string) => ({
  id: 'L1',
  date: '20260924',
  startTime: '9:00',
  courseName,
  room,
});
const json = (courseName: string, room: string) => () =>
  new Response(JSON.stringify({ blockLessons: [lesson(courseName, room)] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const CZ_OK = json('Odborná terminologie v AJ', 'Q01');
const EN_OK = json('English Terminology', 'Q01 EN');
const FAILS = () => Promise.reject(new Error('HTTP 502'));

function answer(cz: () => unknown, en: () => unknown): void {
  fetchWithAuth.mockImplementation((url: string) => (url.includes('lang=en') ? en() : cz()));
}

describe('fetchDualLanguageSchedule: a failed leg is a failed read', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['cz', 'the Czech leg', FAILS, EN_OK],
    ['en', 'the English leg', CZ_OK, FAILS],
    ['both', 'the Czech leg', FAILS, EN_OK],
    ['both', 'the English leg', CZ_OK, FAILS],
  ] as const)("'%s' with %s failing is null", async (lang, _leg, cz, en) => {
    answer(cz, en);
    await expect(fetchDualLanguageSchedule(RANGE, lang)).resolves.toBeNull();
  });

  it("'cz' carries the Czech names, which a Czech UI renders", async () => {
    answer(CZ_OK, EN_OK);
    const [l] = (await fetchDualLanguageSchedule(RANGE, 'cz'))!;
    expect(localizedCourseName(l!, 'cz')).toBe('Odborná terminologie v AJ');
    expect(l).toMatchObject({ roomCs: 'Q01' });
    expect(l!.courseNameEn).toBeUndefined();
  });

  it("'en' carries the English names, which an English UI renders", async () => {
    answer(CZ_OK, EN_OK);
    const [l] = (await fetchDualLanguageSchedule(RANGE, 'en'))!;
    expect(localizedCourseName(l!, 'en')).toBe('English Terminology');
    expect(l).toMatchObject({ roomEn: 'Q01 EN' });
    expect(l!.courseNameCs).toBeUndefined();
  });

  it("'both' merges, so each language renders its own names", async () => {
    answer(CZ_OK, EN_OK);
    const [l] = (await fetchDualLanguageSchedule(RANGE, 'both'))!;
    expect(localizedCourseName(l!, 'cz')).toBe('Odborná terminologie v AJ');
    expect(localizedCourseName(l!, 'en')).toBe('English Terminology');
  });
});
