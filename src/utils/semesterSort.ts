/**
 * Semester Sorting Utility
 * 
 * Provides chronological sorting for academic semesters.
 * 
 * Academic year convention:
 * - ZS (Zimní semestr / Winter) runs Sep–Dec of the START year
 * - LS (Letní semestr / Summer) runs Feb–May of the FOLLOWING year
 * 
 * Example: For academic year 2024/2025:
 * - ZS 2024/2025 = Fall 2024 (Sep–Dec 2024)
 * - LS 2024/2025 = Spring 2025 (Feb–May 2025)
 * 
 * So chronologically: LS 24/25 > ZS 24/25 > LS 23/24 > ZS 23/24 > ...
 */

export interface SemesterLike {
    year: number;
    semesterName: string;
}

/**
 * Compare two semesters for chronological sorting (newest first).
 * Returns negative if `a` is more recent, positive if `b` is more recent.
 */
export function compareSemesters(a: SemesterLike, b: SemesterLike): number {
    // Higher year first
    if (a.year !== b.year) return b.year - a.year;
    
    // Within same academic year: LS (spring) is MORE RECENT than ZS (fall)
    const isWinterA = a.semesterName.startsWith('ZS');
    const isWinterB = b.semesterName.startsWith('ZS');
    
    if (!isWinterA && isWinterB) return -1; // LS before ZS
    if (isWinterA && !isWinterB) return 1;  // ZS after LS
    
    return 0;
}

/**
 * Sort an array of semesters chronologically (newest first).
 */
export function sortSemesters<T extends SemesterLike>(semesters: T[]): T[] {
    return [...semesters].sort(compareSemesters);
}
