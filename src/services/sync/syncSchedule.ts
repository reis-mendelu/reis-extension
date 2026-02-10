/**
 * Sync schedule data from IS Mendelu to IndexedDB.
 */

import { IndexedDBService } from '../storage';
import { fetchDualLanguageSchedule } from '../../api/schedule';

export async function syncSchedule(): Promise<void> {
    console.log('[syncSchedule] 🔄 Starting localized schedule sync...');

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
        end = new Date(currentYear + 1, 7, 31); // Aug 31 next year (fetch both)
    } else if (currentMonth <= 1) {
        // January/February = Transition period
        start = new Date(currentYear - 1, 8, 1); // Sep 1 previous year
        end = new Date(currentYear, 7, 31); // Aug 31 this year (fetch both)
    } else {
        // March-August = Summer semester
        start = new Date(currentYear, 1, 1); // Feb 1
        end = new Date(currentYear, 7, 31); // Aug 31
    }

    console.log(`[syncSchedule] 📅 Fetching from ${start.toDateString()} to ${end.toDateString()}`);

    const data = await fetchDualLanguageSchedule({ start, end });

    if (data && data.length > 0) {
        console.log(`[syncSchedule] ✅ Received ${data.length} lessons`);
        if (data.length > 0) {
            console.log(`[syncSchedule] 📝 Sample lesson: ${data[0].courseName} (${data[0].courseCode})`);
        }
        await IndexedDBService.set('schedule', 'current', data);
        await IndexedDBService.set('meta', 'schedule_week_start', start.toISOString());
        console.log(`[syncSchedule] 💾 Stored ${data.length} lessons for semester`);
    } else {
        console.log('[syncSchedule] ⚠️ No schedule data found, clearing stale data');
        await IndexedDBService.delete('schedule', 'current');
    }
}
