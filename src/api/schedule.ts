import { fetchWithAuth, BASE_URL } from "./client";
import { getUserId } from "./user";
import { getScheduleFormat } from "../utils/date";
import { getUserParams } from "../utils/userParams";
import type { BlockLesson, ScheduleData } from "../types/schedule";

const SCHEDULE_URL = `${BASE_URL}/auth/katalog/rozvrhy_view.pl`;

export async function fetchWeekSchedule(specific?: { start: Date, end: Date }, lang: string = 'cz'): Promise<BlockLesson[] | null> {
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
        rezervace: "0",
        poznamky_base: "1",
        poznamky_parovani: "1",
        poznamky_jiny_areal: "1",
        poznamky_dl_omez: "1",
        typ_vypisu: "konani",
        konani_od: start,
        konani_do: end,
        format: "json",
        lang: isLang,
        nezvol_all: "2",
        poznamky: "1",
        poznamky_zmeny: "1",
        poznamky_dalsi_ucit: "1",
        zobraz: "1",
        zobraz2: "Zobrazit"
    });

    try {
        const response = await fetchWithAuth(`${SCHEDULE_URL}?lang=${isLang}`, {
            method: "POST",
            body: body,
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            return [];
        }

        const text = await response.text();
        try {
            const data: ScheduleData = JSON.parse(text);
            return data.blockLessons || [];
        } catch (e) {
            console.warn('[schedule] JSON parse failed:', e);
            return null;
        }
    } catch (error) {
        console.error("[fetchWeekSchedule] Error fetching schedule:", error);
        return null;
    }
}

/**
 * Fetches schedule in both Czech and English and merges them.
 * Each lesson will have both courseNameCs/courseNameEn and roomCs/roomEn populated.
 */
export async function fetchDualLanguageSchedule(dateRange: { start: Date, end: Date }): Promise<BlockLesson[] | null> {
    try {
        // Fetch both languages in parallel
        const [czLessons, enLessons] = await Promise.all([
            fetchWeekSchedule(dateRange, 'cz'),
            fetchWeekSchedule(dateRange, 'en')
        ]);

        if (!czLessons || !enLessons) {
            // Fall back to whichever succeeded
            return czLessons || enLessons;
        }

        // Create a map of EN lessons by unique key (id + date + startTime)
        const enMap = new Map<string, BlockLesson>();
        for (const lesson of enLessons) {
            const key = `${lesson.id}_${lesson.date}_${lesson.startTime}`;
            enMap.set(key, lesson);
        }

        // Merge: use CZ as base, add EN names
        const merged = czLessons.map(czLesson => {
            const key = `${czLesson.id}_${czLesson.date}_${czLesson.startTime}`;
            const enLesson = enMap.get(key);

            return {
                ...czLesson,
                courseNameCs: czLesson.courseName,
                courseNameEn: enLesson?.courseName || czLesson.courseName, // Fallback to CZ if EN not found
                roomCs: czLesson.room,
                roomEn: enLesson?.room || czLesson.room,
            };
        });

        return merged;
    } catch (error) {
        console.error('[fetchDualLanguageSchedule] Error:', error);
        return null;
    }
}
