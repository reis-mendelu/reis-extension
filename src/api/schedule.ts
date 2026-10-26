import { fetchWithAuth, BASE_URL } from './client';
import { getUserId } from './user';
import { getScheduleFormat } from '../utils/date';
import { getUserParams } from '../utils/userParams';
import { logError } from '../utils/reportError';
import type { BlockLesson, ScheduleData } from '../types/schedule';

const SCHEDULE_URL = `${BASE_URL}/auth/katalog/rozvrhy_view.pl`;

/**
 * IS's "this window has no lessons" sentence, in both languages it serves.
 *
 * BOTH are required, not one: `fetchDualLanguageSchedule` asks for `cz` AND
 * `en` on every sync, and IS translates the page. Matching only the Czech one
 * made the English leg return `null` — a reported failure — for a window that
 * merely has nothing in it, filing a false error on every sync cycle.
 *
 * Measured against live IS on 2026-09-21, same empty window, same session.
 * The English grammar is IS's own; do not "correct" it.
 */
export const NO_RESULTS_MARKERS = [
  'nevyhovuje žádná rozvrhová akce',
  'No class match the selected criteria',
] as const;

export async function fetchWeekSchedule(
  specific?: { start: Date; end: Date },
  lang: string = 'cz'
): Promise<BlockLesson[] | null> {
  const isLang = lang;
  const userId = await getUserId();
  if (!userId) return null;

  const userParams = await getUserParams();

  if (!userParams) return null;

  const studiumId = userParams.studium;
  const obdobiId = userParams.obdobi;

  let start: string;
  let end: string;

  if (specific) {
    start = getScheduleFormat(specific.start);
    end = getScheduleFormat(specific.end);
  } else {
    // This branch shouldn't be used anymore, but keep for backwards compatibility
    const now = new Date();
    start = getScheduleFormat(now);
    const weekLater = new Date(now);
    weekLater.setDate(weekLater.getDate() + 7);
    end = getScheduleFormat(weekLater);
  }

  const body = new URLSearchParams({
    rozvrh_student: userId,
    zpet: `../student/moje_studium.pl?_m=3110,studium=${studiumId},obdobi=${obdobiId};lang=${isLang}`,
    rezervace: '0',
    poznamky_base: '1',
    poznamky_parovani: '1',
    poznamky_jiny_areal: '1',
    poznamky_dl_omez: '1',
    typ_vypisu: 'konani',
    konani_od: start,
    konani_do: end,
    format: 'json',
    lang: isLang,
    nezvol_all: '2',
    poznamky: '1',
    poznamky_zmeny: '1',
    poznamky_dalsi_ucit: '1',
    zobraz: '1',
    zobraz2: 'Zobrazit',
  });

  try {
    const response = await fetchWithAuth(`${SCHEDULE_URL}?lang=${isLang}`, {
      method: 'POST',
      body: body,
    });

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (!contentType || !contentType.includes('application/json')) {
      // IS answers a window with NO lessons in it with an HTML page instead of
      // empty JSON — measured on 2026-09-21, same session, only the range
      // varying (01.09.2026–31.08.2027 → JSON/136 lessons, 01.03.2026–
      // 31.03.2026 → text/html). The page carries `logout.pl`, so
      // `isAuthenticatedHtml` waves it through as data.
      //
      // That sentence is the whole discrimination: with it, the answer is a
      // true "you have no lessons"; without it the body is a login page, an IS
      // error or anything else, and the caller must hear a FAILURE. Returning
      // [] for both is what let a broken fetch wipe a real timetable.
      // Fixtures: src/api/__tests__/fixtures/is-rozvrh-no-results{,-en}.html
      if (NO_RESULTS_MARKERS.some((marker) => text.includes(marker))) return [];
      logError('Api.fetchWeekSchedule:nonJson', new Error('Non-JSON schedule response'), {
        lang,
        contentType,
      });
      return null;
    }

    try {
      const data: ScheduleData = JSON.parse(text);
      return data.blockLessons || [];
    } catch (e) {
      logError('Api.fetchWeekSchedule:jsonParse', e);
      return null;
    }
  } catch (error) {
    logError('Api.fetchWeekSchedule', error, { lang });
    return null;
  }
}

/**
 * CZ lessons as the base, EN names and rooms joined on id + date + start time
 * (IS reuses a lesson id across the weeks it repeats). Falls back to the CZ text
 * where the EN leg has no match. Shared with the impersonation fetch.
 */
export function mergeDualLanguageLessons(
  czLessons: BlockLesson[],
  enLessons: BlockLesson[]
): BlockLesson[] {
  const enMap = new Map<string, BlockLesson>();
  for (const lesson of enLessons) {
    enMap.set(`${lesson.id}_${lesson.date}_${lesson.startTime}`, lesson);
  }
  return czLessons.map((czLesson) => {
    const enLesson = enMap.get(`${czLesson.id}_${czLesson.date}_${czLesson.startTime}`);
    return {
      ...czLesson,
      courseNameCs: czLesson.courseName,
      courseNameEn: enLesson?.courseName || czLesson.courseName,
      roomCs: czLesson.room,
      roomEn: enLesson?.room || czLesson.room,
    };
  });
}

/**
 * Fetches schedule in both Czech and English and merges them.
 * Each lesson will have both courseNameCs/courseNameEn and roomCs/roomEn populated.
 *
 * Both legs or `null`. This used to fall back to whichever leg succeeded, and a
 * surviving EN leg is raw English lessons with no `courseNameCs` — so one flaky
 * CZ request turned a Czech student's calendar English, and the refresh wrote
 * that over the good cached copy. `null` is what every caller already treats as
 * "failed, keep what is cached" (see scheduleDualLanguage.test.ts).
 */
export async function fetchDualLanguageSchedule(dateRange: {
  start: Date;
  end: Date;
}): Promise<BlockLesson[] | null> {
  try {
    // Fetch both languages in parallel
    const [czLessons, enLessons] = await Promise.all([
      fetchWeekSchedule(dateRange, 'cz'),
      fetchWeekSchedule(dateRange, 'en'),
    ]);

    if (!czLessons || !enLessons) return null;

    return mergeDualLanguageLessons(czLessons, enLessons);
  } catch (error) {
    logError('Api.fetchDualLanguageSchedule', error);
    return null;
  }
}
