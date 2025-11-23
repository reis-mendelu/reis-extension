import { fetchWithAuth, BASE_URL } from "./client";
import { parseRegisteredExams } from "../utils/examParser";
import type { ExamEvent } from "../utils/examParser";
import { encryptData, decryptData } from "../utils/encryption";

// Hardcoded URL for now as per request, but ideally should be dynamic
const EXAMS_URL = `${BASE_URL}/auth/student/terminy_seznam.pl?studium=149707;obdobi=801;lang=cz`;

const STORAGE_KEY = 'reis_exams_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (or adjust as needed)

export async function getCachedExams(): Promise<ExamEvent[] | null> {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const cached = result[STORAGE_KEY] as { data: string, timestamp: number };
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            // Decrypt cached exam data
            const decryptedData = await decryptData(cached.data);
            return JSON.parse(decryptedData);
        }
        return null;
    } catch (error) {
        console.error("Failed to get cached exams:", error);
        return null;
    }
}

export async function fetchExams(): Promise<ExamEvent[]> {
    try {
        const response = await fetchWithAuth(EXAMS_URL, {
            method: "GET",
        });

        // The response might be HTML
        const html = await response.text();
        const events = parseRegisteredExams(html);

        // Encrypt and cache the results
        if (events.length > 0) {
            const encryptedData = await encryptData(JSON.stringify(events));
            await chrome.storage.local.set({
                [STORAGE_KEY]: {
                    data: encryptedData,
                    timestamp: Date.now()
                }
            });
        }

        return events;
    } catch (error) {
        console.error("Failed to fetch exams:", error);
        return [];
    }
}
