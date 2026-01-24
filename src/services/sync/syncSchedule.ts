/**
 * Sync schedule data from IS Mendelu to IndexedDB.
 */

import { IndexedDBService } from '../storage';
import { fetchWeekSchedule } from '../../api/schedule';

export async function syncSchedule(): Promise<void> {
    console.log('[syncSchedule] Fetching semester schedule data...');

    // Determine semester boundaries
    // Winter semester: September 1 - February 28
    // Summer semester: February 1 - August 31
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    let start: Date;
    let end: Date;

    if (currentMonth >= 8) {
        // September (8) onwards = Winter semester of this academic year
        start = new Date(currentYear, 8, 1); // Sep 1
        end = new Date(currentYear + 1, 1, 28); // Feb 28 next year
    } else if (currentMonth <= 1) {
        // January/February = Winter semester from previous year
        start = new Date(currentYear - 1, 8, 1); // Sep 1 previous year
        end = new Date(currentYear, 1, 28); // Feb 28 this year
    } else {
        // March-August = Summer semester
        start = new Date(currentYear, 1, 1); // Feb 1
        end = new Date(currentYear, 7, 31); // Aug 31
    }

    console.log(`[syncSchedule] Fetching from ${start.toDateString()} to ${end.toDateString()}`);

    const data = await fetchWeekSchedule({ start, end });

    if (data && data.length > 0) {
        await IndexedDBService.set('schedule', 'current', data);
        await IndexedDBService.set('meta', 'schedule_week_start', start.toISOString());
        console.log(`[syncSchedule] Stored ${data.length} lessons for semester`);
    } else {
        console.log('[syncSchedule] No schedule data to store');
    }
}
