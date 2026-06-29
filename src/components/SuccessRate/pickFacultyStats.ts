/**
 * Pick the stats for a faculty. Success data labels semesters with the Czech
 * faculty code (e.g. "LS 2025/2026 - PEF"), but a subject opened from the English
 * search carries the English faculty code (e.g. "FBE"), which would never match.
 * Subject codes are faculty-unique, so when the faculty filter matches nothing we
 * fall back to all stats rather than wrongly showing "no data".
 */
export function pickFacultyStats<T extends { semesterName: string }>(allStats: T[], facultyCode?: string): T[] {
    if (!facultyCode) return allStats;
    const matched = allStats.filter(s => s.semesterName.split(' - ').at(-1) === facultyCode);
    return matched.length > 0 ? matched : allStats;
}
