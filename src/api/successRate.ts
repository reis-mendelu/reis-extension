
import { fetchWithAuth, BASE_URL } from "./client";
import type { SubjectSuccessRate, SemesterStats, TermStats, GradeStats, SuccessRateData } from "../types/documents";

const STATS_URL = `${BASE_URL}/auth/student/hodnoceni.pl`;
const FACULTY_ID = 2; // PEF - currently hardcoded as per scraper requirement, could be dynamic later
const MAX_HISTORY_YEARS = 15;

/**
 * Mappable legacy codes.
 * e.g. EBC-ALG -> ALG, EBC_ALG -> ALG
 */
function getLegacyCodes(currentCode: string): string[] {
    const legacy: string[] = [];
    // EBC-XYZ -> XYZ
    if (currentCode.startsWith('EBC-')) {
        legacy.push(currentCode.replace('EBC-', ''));
    }
    // EBC_XYZ -> XYZ  
    if (currentCode.startsWith('EBC_')) {
        legacy.push(currentCode.replace('EBC_', ''));
    }
    // Add other patterns if known
    return legacy;
}

/**
 * Fetches success rates for the given list of target course codes.
 * Returns a SuccessRateData object.
 */
export async function fetchSubjectSuccessRates(targetCodes: string[]): Promise<SuccessRateData> {
    console.log(`[SuccessRate] Starting fetch for ${targetCodes.length} courses...`);
    
    // Create a set of all codes to look for (including legacy)
    const searchSet = new Set<string>();
    targetCodes.forEach(code => {
        searchSet.add(code);
        getLegacyCodes(code).forEach(l => searchSet.add(l));
    });
    
    // Result map
    const results: Record<string, SubjectSuccessRate> = {};
    const currentYear = new Date().getFullYear();

    try {
        // 1. Get main page to find semester links
        // We visit the faculty page directly
        const startUrl = `${STATS_URL}?fakulta=${FACULTY_ID};lang=cz`;
        const doc = await fetchDocument(startUrl);
        
        if (!doc) throw new Error("Failed to load initial stats page");

        // 2. Find semester links in the "obdobi" selector or links
        // The MENDELU layout: The top menu usually has a dropdown or links for periods.
        // Actually, the scraper used `page.locator('table#tmtab_1 tr.uis-hl-table')` on the initial page?
        // No, the scraper iterated `fakulta` then `obdobi`.
        // Let's assume the page contains links to periods.
        // Based on scraper: "const semesterLinks = ... locator('tr.uis-hl-table')"
        // Wait, the "Faculty" page lists semesters?
        // Yes, the screenshot shows "Hodnocení úspěšnosti předmětů » PEF" and then a list could be there.
        // Let's look for links with `obdobi=`
        
        const validSemesters = parseSemesters(doc, currentYear);
        console.log(`[SuccessRate] Found ${validSemesters.length} valid semesters`);

        // 3. Process each semester (sequentially to match usage pattern, maybe parallelize slightly)
        for (const sem of validSemesters) {
             console.log(`[SuccessRate] Processing ${sem.name} (${sem.url})`);
             try {
                 await processSemester(sem, searchSet, results);
             } catch (e) {
                 console.error(`[SuccessRate] Failed to process ${sem.name}:`, e);
             }
        }

        // 4. Transform results (re-link legacy stats to main codes)
        const finalData: Record<string, SubjectSuccessRate> = {};
        
        // Initialize entries for requested codes
        targetCodes.forEach(code => {
            finalData[code] = {
                courseCode: code,
                stats: [],
                lastUpdated: new Date().toISOString()
            };
        });

        // Merge found stats
        for (const [foundCode, rate] of Object.entries(results)) {
            // Find which target code this belongs to
            const target = targetCodes.find(t => t === foundCode || getLegacyCodes(t).includes(foundCode));
            if (target) {
                finalData[target].stats.push(...rate.stats);
            }
        }

        return {
            lastUpdated: new Date().toISOString(),
            data: finalData
        };

    } catch (error) {
        console.error("[SuccessRate] Critical failure:", error);
        throw error;
    }
}

interface SemesterLink {
    name: string;
    url: string;
    year: number;
    id: string; // from obdobi=XXX
}

async function fetchDocument(url: string): Promise<Document | null> {
    console.log(`[SuccessRate DEBUG] fetchDocument: ${url}`);
    const res = await fetchWithAuth(url);
    if (!res.ok) {
        console.log(`[SuccessRate DEBUG] fetchDocument: HTTP ${res.status}`);
        return null;
    }
    const text = await res.text();
    
    // Log first 500 chars to check if we got the right page
    console.log(`[SuccessRate DEBUG] Response preview (${text.length} chars):`, text.substring(0, 500));
    
    // Check for login page redirect
    if (text.includes('login.pl') || text.includes('Přihlášení')) {
        console.warn('[SuccessRate DEBUG] Detected login page - not authenticated!');
    }
    
    const doc = new DOMParser().parseFromString(text, 'text/html');
    console.log(`[SuccessRate DEBUG] Page title: ${doc.title}`);
    
    // Log key elements for debugging
    const table = doc.querySelector('table#tmtab_1');
    console.log(`[SuccessRate DEBUG] table#tmtab_1 found: ${!!table}`);
    
    return doc;
}

function parseSemesters(doc: Document, currentYear: number): SemesterLink[] {
    const list: SemesterLink[] = [];
    
    // The Playwright test uses: table#tmtab_1 tr.uis-hl-table
    // Name is in td.nth(1) (2nd cell, 0-indexed)
    // Link is in td.nth(4) (5th cell, 0-indexed)
    
    const table = doc.querySelector('table#tmtab_1');
    if (!table) {
        console.warn('[SuccessRate DEBUG] No table#tmtab_1 found - checking for any tables');
        const allTables = doc.querySelectorAll('table');
        console.log(`[SuccessRate DEBUG] Found ${allTables.length} tables total`);
        allTables.forEach((t, i) => {
            console.log(`[SuccessRate DEBUG] Table ${i}: id="${t.id}" class="${t.className}"`);
        });
        return list;
    }
    
    const rows = table.querySelectorAll('tr.uis-hl-table');
    console.log(`[SuccessRate DEBUG] parseSemesters: found ${rows.length} rows in table#tmtab_1`);
    
    rows.forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        console.log(`[SuccessRate DEBUG] Row ${i}: ${cells.length} cells`);
        
        // Name is in td.nth(1) = 2nd cell (index 1)
        const nameCell = cells[1];
        // Link is in td.nth(4) = 5th cell (index 4)
        const linkCell = cells[4];
        
        if (!nameCell || !linkCell) {
            console.log(`[SuccessRate DEBUG] Row ${i}: Missing nameCell or linkCell`);
            return;
        }
        
        const name = nameCell.textContent?.trim() || '';
        const link = linkCell.querySelector('a');
        
        if (!link) {
            console.log(`[SuccessRate DEBUG] Row ${i}: No link in cell 4, name="${name}"`);
            return;
        }
        
        const href = link.getAttribute('href');
        console.log(`[SuccessRate DEBUG] Row ${i}: name="${name}" href="${href}"`);
        
        // Check for year in name
        const yearMatch = name.match(/(\d{4})/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            const isRecent = year >= (currentYear - MAX_HISTORY_YEARS);
            console.log(`[SuccessRate DEBUG]   -> Year: ${year}, Recent: ${isRecent}`);
            
            if (isRecent && href) {
                const idMatch = href.match(/obdobi=(\d+)/);
                list.push({
                    name,
                    url: new URL(href, BASE_URL + '/auth/student/').href,
                    year,
                    id: idMatch ? idMatch[1] : '0'
                });
            }
        } else {
            console.log(`[SuccessRate DEBUG]   -> No year found in name "${name}"`);
        }
    });


    return list;
}

async function processSemester(sem: SemesterLink, searchSet: Set<string>, results: Record<string, SubjectSuccessRate>) {
    const doc = await fetchDocument(sem.url);
    if (!doc) return;

    // Find course links
    const courseRows = doc.querySelectorAll('tr.uis-hl-table');
    const matchedCourses: { code: string, url: string }[] = [];

    courseRows.forEach(row => {
        // Code is usually in 1st cell
        const codeCell = row.querySelector('td:nth-of-type(1)');
        const link = row.querySelector('td:nth-of-type(5) a'); // "Zvolit" button -> 5th or last cell
        
        if (codeCell && link) {
            const code = codeCell.textContent?.trim() || '';
            if (searchSet.has(code)) {
                const href = link.getAttribute('href');
                if (href) {
                    matchedCourses.push({
                         code,
                         url: new URL(href, BASE_URL + '/auth/').href
                    });
                }
            }
        }
    });

    console.log(`[SuccessRate] ${sem.name}: Found ${matchedCourses.length} target courses`);

    // Fetch stats for each course
    for (const course of matchedCourses) {
        const statsDoc = await fetchDocument(course.url);
        if (!statsDoc) continue;

        const stats = parseStatsTable(statsDoc);
        if (stats) {
            if (!results[course.code]) {
                results[course.code] = { 
                    courseCode: course.code, 
                    stats: [], 
                    lastUpdated: new Date().toISOString() 
                };
            }
            results[course.code].stats.push({
                semesterName: sem.name,
                semesterId: sem.id,
                year: sem.year,
                totalPass: stats.pass,
                totalFail: stats.fail,
                terms: stats.terms
            });
        }
    }
}

function parseStatsTable(doc: Document): { pass: number, fail: number, terms: TermStats[] } | null {
    // Find table with stats
    // The scraper looked for `table` with specific headers or just iterating rows
    // We can look for row texts like "termín 1", "termín 2"
    
    // Usually the table doesn't have a unique ID reliable for "stats", but let's try `table`
    // The scraper used `locator('table').filter({ hasText: 'Termín' })`
    
    const tables = doc.querySelectorAll('table');
    let targetTable: HTMLTableElement | null = null;
    
    for (let i = 0; i < tables.length; i++) {
        if (tables[i].textContent?.includes('Termín') && tables[i].textContent?.includes('zk-nedost')) {
            targetTable = tables[i];
            break;
        }
    }

    if (!targetTable) return null;

    let totalPass = 0;
    let totalFail = 0;
    const terms: TermStats[] = [];

    const rows = targetTable.querySelectorAll('tr.uis-hl-table');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 9) return;

        const getVal = (idx: number) => {
            const txt = cells[idx]?.textContent || '0';
            const val = parseInt(txt.trim(), 10);
            return isNaN(val) ? 0 : val;
        };

        const termName = cells[1].textContent?.trim() || '';
        const a = getVal(2);
        const b = getVal(3);
        const c = getVal(4);
        const d = getVal(5);
        const e = getVal(6);
        const f = getVal(7);
        const fail = getVal(8);

        const rowPass = a + b + c + d + e;
        const rowFail = f + fail;

        totalPass += rowPass;
        totalFail += rowFail;

        terms.push({
            term: termName,
            grades: { A: a, B: b, C: c, D: d, E: e, F: f, FN: fail },
            pass: rowPass,
            fail: rowFail
        });
    });

    return { pass: totalPass, fail: totalFail, terms };
}
