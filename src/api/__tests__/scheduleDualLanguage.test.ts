import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A timetable read is BOTH languages or it is a failure.
 *
 * The phone's calendar refresh randomly turned the timetable English for a
 * Czech student. Live IS was probed on 2026-09-24 — 60 parallel `cz`/`en`
 * requests on one session, every one answered in the language it asked for, and
 * no language cookie set — so IS was not mixing them up. What did it was the
 * fallback here: one leg failing (a flaky mobile request) made the other leg's
 * raw lessons the whole timetable. When the survivor was English, those lessons
 * had no `courseNameCs`, `localizedCourseName` fell back to `courseName`, and
 * the refresh wrote the English copy over a good cached one.
 *
 * Either leg failing looks random from the outside, and only the Czech one is
 * visible to a Czech student — so the test keys every answer on the request's
 * own `lang`, which a single `mockResolvedValue` cannot express.
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

function lesson(courseName: string, room: string) {
  return { id: 'L1', date: '20260924', startTime: '9:00', courseName, room };
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const CZ_OK = () => json({ blockLessons: [lesson('Odborná terminologie v AJ', 'Q01')] });
const EN_OK = () => json({ blockLessons: [lesson('English Terminology', 'Q01 EN')] });
const FAILS = () => Promise.reject(new Error('HTTP 502'));

function answer(byLang: { cz: () => unknown; en: () => unknown }): void {
  fetchWithAuth.mockImplementation((url: string) =>
    url.includes('lang=en') ? byLang.en() : byLang.cz()
  );
}

describe('fetchDualLanguageSchedule treats a one-language read as a failure', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when the Czech leg fails, instead of an English timetable', async () => {
    answer({ cz: FAILS, en: EN_OK });
    const result = await fetchDualLanguageSchedule(RANGE, 'both');
    // The reported symptom, had this come back as data:
    // localizedCourseName(result[0], 'cz') === 'English Terminology'.
    expect(result).toBeNull();
  });

  it('returns null when the Czech leg answers something that is not the timetable', async () => {
    answer({ cz: () => new Response('<html>chyba</html>', { status: 200 }), en: EN_OK });
    await expect(fetchDualLanguageSchedule(RANGE, 'both')).resolves.toBeNull();
  });

  it('returns null when the English leg fails, so an English student is not handed Czech', async () => {
    answer({ cz: CZ_OK, en: FAILS });
    await expect(fetchDualLanguageSchedule(RANGE, 'both')).resolves.toBeNull();
  });

  it('merges both legs, so each language renders its own names', async () => {
    answer({ cz: CZ_OK, en: EN_OK });
    const result = await fetchDualLanguageSchedule(RANGE, 'both');
    expect(result).toHaveLength(1);
    const [merged] = result!;
    expect(localizedCourseName(merged!, 'cz')).toBe('Odborná terminologie v AJ');
    expect(localizedCourseName(merged!, 'en')).toBe('English Terminology');
    expect(merged).toMatchObject({ roomCs: 'Q01', roomEn: 'Q01 EN' });
  });
});
