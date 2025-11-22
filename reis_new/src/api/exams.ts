import { fetchWithAuth, BASE_URL } from "./client";
import { parseRegisteredExams } from "../utils/examParser";
import type { ExamEvent } from "../utils/examParser";

// Hardcoded URL for now as per request, but ideally should be dynamic
const EXAMS_URL = `${BASE_URL}/auth/student/terminy_seznam.pl?studium=149707;obdobi=801;lang=cz`;

const STORAGE_KEY = 'reis_exams_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (or adjust as needed)

export async function getCachedExams(): Promise<ExamEvent[] | null> {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const cached = result[STORAGE_KEY] as any;
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log("Returning cached exams");
            return cached.data;
        }
        return null;
    } catch (error) {
        console.error("Failed to get cached exams:", error);
        return null;
    }
}

export async function fetchExams(): Promise<ExamEvent[]> {
    try {
        console.log("Fetching exams from:", EXAMS_URL);
        const response = await fetchWithAuth(EXAMS_URL, {
            method: "GET",
        });

        // The response might be HTML
        const html = await response.text();
        console.log("Exams HTML length:", html.length);
        const events = parseRegisteredExams(html);
        console.log("Parsed exam events:", events);

        // Cache the results
        if (events.length > 0) {
            await chrome.storage.local.set({
                [STORAGE_KEY]: {
                    data: events,
                    timestamp: Date.now()
                }
            });
            console.log("Exams cached successfully");
        }

        return events;
    } catch (error) {
        console.error("Failed to fetch exams:", error);
        return [];
    }
}
