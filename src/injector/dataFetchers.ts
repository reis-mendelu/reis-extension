import { fetchDualLanguageSchedule } from "../api/schedule";

export async function fetchScheduleBite() {
    console.log('[fetchScheduleBite] 🌐 Fetching immediate schedule bite (+/- 2 weeks)...');
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 14);
    const end = new Date(now);
    end.setDate(now.getDate() + 14);
    
    return fetchDualLanguageSchedule({ start, end });
}

export async function fetchFullSemesterSchedule() {
    console.log('[fetchFullSemesterSchedule] 🌐 Fetching full semester schedule...');
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

