/**
 * Success Rate Data Validators
 * 
 * Munger's Inversion: Test for what we DON'T know.
 * Single Points of Failure:
 *   1. CDN availability (does the file exist?)
 *   2. Semester format parsing (does ZS/LS detection work?)
 *   3. Data shape (is the JSON structure valid?)
 * 
 * These validators can be run independently without full scraping.
 */

const CDN_BASE_URL = "https://raw.githubusercontent.com/darksoothingshadow/reis-data/main";

// --- Type Definitions ---

export interface ValidationResult {
    code: string;
    status: 'ok' | 'missing' | 'invalid' | 'error';
    message: string;
    data?: unknown;
}

export interface SemesterParseResult {
    isWinter: boolean;
    yearStart: number;
    yearLabel: string; // e.g., "ZS 24/25"
}

// --- Single Point of Failure #1: CDN Availability ---

/**
 * Check if a subject exists in CDN. No scraping required.
 * This is the FIRST thing to test when "data nejsou k dispozici".
 */
export async function checkCDNAvailability(code: string): Promise<ValidationResult> {
    const url = `${CDN_BASE_URL}/subjects/${code}.json`;
    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
            return { code, status: 'ok', message: `✅ ${code} exists in CDN` };
        }
        if (response.status === 404) {
            return { code, status: 'missing', message: `❌ ${code} NOT FOUND in CDN (404)` };
        }
        return { code, status: 'error', message: `⚠️ ${code} returned HTTP ${response.status}` };
    } catch (err) {
        return { code, status: 'error', message: `⚠️ ${code} network error: ${err}` };
    }
}

/**
 * Batch check multiple codes. Returns a summary.
 */
export async function batchCheckCDN(codes: string[]): Promise<ValidationResult[]> {
    return Promise.all(codes.map(checkCDNAvailability));
}

// --- Single Point of Failure #2: Semester Format Parsing ---

/**
 * Parse a semester name into components.
 * Tests the exact logic used in SuccessRateTab.tsx.
 * 
 * Input formats:
 *   - "LS 2024/2025 - FRRMS"
 *   - "ZS 2024/2025 - PEF"
 *   - "ZS 2023/2024"
 */
export function parseSemesterName(semesterName: string): SemesterParseResult {
    const isWinter = semesterName.startsWith('ZS');
    
    // Extract year from "LS 2024/2025 - FRRMS" format
    const yearMatch = semesterName.match(/(\d{4})\/(\d{4})/);
    const yearStart = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    
    const yearShort = yearStart % 100;
    const semesterPrefix = isWinter ? 'ZS' : 'LS';
    const yearLabel = `${semesterPrefix} ${yearShort}/${yearShort + 1}`;
    
    return { isWinter, yearStart, yearLabel };
}

// --- Single Point of Failure #3: Data Shape Validation ---

/**
 * Validate the shape of CDN data (without fetching full content).
 * Returns specific failure reasons.
 */
export function validateDataShape(data: unknown): ValidationResult {
    if (!data || typeof data !== 'object') {
        return { code: '', status: 'invalid', message: 'Data is null or not an object' };
    }
    
    const obj = data as Record<string, unknown>;
    
    if (!obj.courseCode || typeof obj.courseCode !== 'string') {
        return { code: '', status: 'invalid', message: 'Missing or invalid courseCode' };
    }
    
    if (!Array.isArray(obj.stats)) {
        return { code: String(obj.courseCode), status: 'invalid', message: 'Missing stats array' };
    }
    
    if (obj.stats.length === 0) {
        return { code: String(obj.courseCode), status: 'invalid', message: 'Empty stats array' };
    }
    
    // Validate first semester entry
    const firstStat = obj.stats[0] as Record<string, unknown>;
    if (!firstStat.semesterName || !firstStat.year) {
        return { 
            code: String(obj.courseCode), 
            status: 'invalid', 
            message: 'First stat missing semesterName or year' 
        };
    }
    
    // Sanity bounds check (Seymour Scrutiny)
    const stats = obj.stats as any[];
    for (const stat of stats) {
        const total = (stat.totalPass || 0) + (stat.totalFail || 0);
        if (total === 0 && stat.terms?.length === 0) {
             return { code: String(obj.courseCode), status: 'invalid', message: `Zero student count in ${stat.semesterName}` };
        }
        if (total > 5000) {
             return { code: String(obj.courseCode), status: 'invalid', message: `Unrealistically high student count (${total}) in ${stat.semesterName}` };
        }
        // Grading distribution sum check
        for (const term of stat.terms || []) {
            const grades = term.grades || {};
            const sum = Object.values(grades).reduce((a: any, b: any) => a + b, 0) as number;
            if (sum !== (term.pass + term.fail)) {
                return { code: String(obj.courseCode), status: 'invalid', message: `Grade sum mismatch in ${stat.semesterName}: ${sum} != ${term.pass + term.fail}` };
            }
        }
    }
    
    return { 
        code: String(obj.courseCode), 
        status: 'ok', 
        message: `✅ Valid shape: ${obj.stats.length} semesters`,
        data: { semesterCount: obj.stats.length }
    };
}

// --- Convenience: Full Single-Subject Audit ---

/**
 * Audit a single subject for all known failure points.
 * No scraping. Just CDN check + format validation.
 */
export async function auditSubject(code: string): Promise<{
    cdnStatus: ValidationResult;
    dataShape?: ValidationResult;
    semesters?: SemesterParseResult[];
}> {
    const cdnStatus = await checkCDNAvailability(code);
    
    if (cdnStatus.status !== 'ok') {
        return { cdnStatus };
    }
    
    // Fetch and validate shape
    const url = `${CDN_BASE_URL}/subjects/${code}.json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        const dataShape = validateDataShape(data);
        
        // Parse all semester names
        const semesters = Array.isArray(data.stats) 
            ? data.stats.map((s: { semesterName: string }) => parseSemesterName(s.semesterName))
            : [];
        
        return { cdnStatus, dataShape, semesters };
    } catch (err) {
        return { 
            cdnStatus, 
            dataShape: { code, status: 'error', message: `Parse error: ${err}` }
        };
    }
}
