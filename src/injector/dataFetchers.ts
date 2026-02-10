import { fetchDualLanguageSchedule } from "../api/schedule";

export async function fetchScheduleData() {
    console.log('[fetchScheduleData] 🌐 Fetching schedule in both languages...');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let start, end;

    if (currentMonth >= 8) {
        start = new Date(currentYear, 8, 1);
        end = new Date(currentYear + 1, 7, 31);
    } else if (currentMonth <= 1) {
        start = new Date(currentYear - 1, 8, 1);
        end = new Date(currentYear, 7, 31);
    } else {
        start = new Date(currentYear, 1, 1);
        end = new Date(currentYear, 7, 31);
    }
    return fetchDualLanguageSchedule({ start, end });
}
