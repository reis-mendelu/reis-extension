import { fetchWithAuth } from './client';
import { getUserParams } from '../utils/userParams';

export interface StudyProgramCourse {
    Semester: string;
    Category: string;
    Code: string;
    Name: string;
    Completion: string;
    Credits: string;
    Link: string;
}

export interface StudyProgramData {
    programs: any[];
    specializations: any[];
    finalTable: StudyProgramCourse[];
    lastUpdated: number;
}

// 4. Program Selection Page (Robust)
function scrapeProgramsAndSpecializations(htmlString: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const origin = "https://is.mendelu.cz";

    function getTableData(headerText: string, typeLabel: string) {
        const headers = Array.from(doc.querySelectorAll('b, strong, h1, h2'));
        const header = headers.find(el => el.textContent?.includes(headerText));
        if (!header) return [];

        let sibling = header.nextElementSibling;
        let table = null;
        for(let i=0; i<5 && sibling; i++) {
            if (sibling.tagName === 'TABLE') { table = sibling; break; }
            if (sibling.querySelector('table')) { table = sibling.querySelector('table'); break; }
            sibling = sibling.nextElementSibling;
        }
        if (!table) return [];

        return Array.from(table.querySelectorAll('tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return null;

            const eyeIcon = row.querySelector('img[sysid="prohlizeni-info"]');
            let url = "N/A";
            if (eyeIcon && eyeIcon.closest('a')) {
                const href = eyeIcon.closest('a')?.getAttribute('href');
                if (href) {
                    if (href.startsWith('http')) url = href;
                    else if (href.startsWith('/')) url = origin + href;
                    else url = origin + "/auth/katalog/" + href;
                }
            }

            return {
                Code: cells[1].textContent?.trim() || "",
                Name: cells[2].textContent?.trim() || "",
                Link: url,
                Type: typeLabel
            };
        }).filter(r => r !== null);
    }

    return {
        programs: getTableData("Výběr studijního programu", "Program"),
        specializations: getTableData("Výběr specializace", "Specialization")
    };
}

// 5. Form Selection Page (Robust)
function scrapeStudyFormLinks(htmlString: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const origin = "https://is.mendelu.cz";

    const headers = Array.from(doc.querySelectorAll('b, strong, h1'));
    const header = headers.find(el => el.textContent?.includes("Výběr formy studia"));
    
    if (!header) return [];

    let table = null;
    let sibling = header.nextElementSibling;
    for(let i=0; i<5 && sibling; i++) {
        if (sibling.tagName === 'TABLE') { table = sibling; break; }
        sibling = sibling.nextElementSibling;
    }
    if (!table) return [];

    const colHeaders = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || "");
    const viewIdx = colHeaders.findIndex(h => h.includes("Prohlížet"));
    if (viewIdx === -1) return [];

    return Array.from(table.querySelectorAll('tbody tr')).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length <= viewIdx) return null;

        const anchor = cells[viewIdx].querySelector('a');
        let url = "N/A";
        if (anchor) {
            const href = anchor.getAttribute('href');
            if (href) {
                if (href.startsWith('http')) url = href;
                else if (href.startsWith('/')) url = origin + href;
                else url = origin + "/auth/katalog/" + href;
            }
        }

        return { Form: cells[0].textContent?.trim() || "", Link: url };
    }).filter(r => r !== null);
}

// 6. The Study Plan Detail (Robust with Debugging)
function scrapeStudyPlanRobust(htmlString: string): StudyProgramCourse[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // Base URL for resolving ".." relative links (goes up to /auth/)
    const authOrigin = "https://is.mendelu.cz/auth"; 
    const rootOrigin = "https://is.mendelu.cz";

    // 1. ANCHORING: Find the table via the semantic header "Název předmětu"
    const allCells = Array.from(doc.querySelectorAll('td, th'));
    const anchorCell = allCells.find(el => el.textContent?.includes("Název předmětu"));

    if (!anchorCell) {
        console.error("[StudyProgram] Structure Error: 'Název předmětu' header not found.");
        return [];
    }

    const table = anchorCell.closest('table');
    if (!table) return [];
    
    // DYNAMIC COLUMN MAPPING
    // We assume the structure relative to "Název předmětu" (Name) is consistent:
    // [Code] [Name] [Completion] [Credits]
    if (!(anchorCell instanceof HTMLTableCellElement)) return [];
    
    const nameIndex = (anchorCell as HTMLTableCellElement).cellIndex;
    const codeIndex = nameIndex - 1;
    const completionIndex = nameIndex + 1;
    const creditsIndex = nameIndex + 2;

    console.log(`[StudyProgram] Column Mapping -> Code: ${codeIndex}, Name: ${nameIndex}, Completion: ${completionIndex}, Credits: ${creditsIndex}`);

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    // 2. STATE MACHINE INITIALIZATION
    let currentSemester = "Unknown Semester";
    let currentCategory = "Uncategorized";
    const studyPlan: StudyProgramCourse[] = [];

    // 3. ITERATION
    rows.forEach(row => {
        const textContent = row.textContent?.trim() || "";

        // A. DETECT SEMESTER (State Change)
        if (row.querySelector('font[size="+1"]') || textContent.match(/^\d+\.\s*semestr/i)) {
            currentSemester = textContent.replace(/\s+/g, " ");
            return; 
        }

        // B. DETECT CATEGORY (State Change)
        if (textContent.includes("Skupina předmětů")) {
            currentCategory = textContent.replace(/\s+/g, " ");
            return;
        }

        // C. DETECT DATA ROW
        const cells = row.querySelectorAll('td');
        
        // Ensure we have enough cells to cover the required columns
        // We need at least up to creditsIndex
        if (codeIndex >= 0 && cells.length > creditsIndex) {
            const code = cells[codeIndex].textContent?.trim() || "";
            const name = cells[nameIndex].textContent?.trim() || "";
            
            // Skip header rows repeating inside
            if (code === "Kód" || code === "") return;

            // Link Extraction
            const anchor = cells[nameIndex].querySelector('a') || cells[codeIndex].querySelector('a');
            let fullUrl = "N/A";
            
            if (anchor && anchor.hasAttribute('href')) {
                const href = anchor.getAttribute('href');
                if (href) {
                    if (href.startsWith('..')) fullUrl = authOrigin + href.substring(2); 
                    else if (href.startsWith('/')) fullUrl = rootOrigin + href;
                    else if (href.startsWith('http')) fullUrl = href;
                    else fullUrl = authOrigin + "/katalog/" + href;
                }
            }

            studyPlan.push({
                Semester: currentSemester,
                Category: currentCategory,
                Code: code,
                Name: name,
                Completion: cells[completionIndex].textContent?.trim() || "",
                Credits: cells[creditsIndex].textContent?.trim() || "",
                Link: fullUrl
            });
        }
    });

    return studyPlan;
}

export async function fetchStudyProgram(): Promise<StudyProgramData | null> {
    try {
        console.log('[StudyProgram] Fetching dynamic study program (Lattice Scripts)...');

        const userParams = await getUserParams();
        if (!userParams || !userParams.facultyId || !userParams.obdobi) {
            console.warn('[StudyProgram] Missing UserParams, cannot fetch dynamic plan.');
            return null;
        }

        // STEP 1: Fetch Programs Component
        const url1 = `https://is.mendelu.cz/auth/katalog/plany.pl?fakulta=${userParams.facultyId}&poc_obdobi=${userParams.obdobi}&typ_studia=1&lang=cz`;
        console.log(`[StudyProgram] 1. Fetching Programs: ${url1}`);
        
        const response1 = await fetchWithAuth(url1);
        const text1 = await response1.text();
        
        const { programs, specializations } = scrapeProgramsAndSpecializations(text1);
        console.log(`[StudyProgram] Found ${programs.length} programs and ${specializations.length} specializations.`);

        // STEP 2: Find Matching Program
        let selectedProgram: any = programs[0]; 
        if (userParams.studyProgram) {
            const searchCode = userParams.studyProgram; 
            
            // Strategy 1: Exact match
            let match = programs.find((p: any) => p.Code === searchCode || p.Name === searchCode);
            
            // Strategy 2: Start of Name (e.g. "B-OI")
            if (!match && searchCode.includes('-')) {
                 const shortCode = searchCode.split('-').slice(0, 2).join('-'); 
                 match = programs.find((p: any) => p.Name.startsWith(shortCode) || p.Code.includes(shortCode));
            }

            // Strategy 3: Loose inclusion
            if (!match) {
                 match = programs.find((p: any) => p.Name.includes(searchCode) || p.Code.includes(searchCode) || searchCode.includes(p.Code));
            }

            if (match) {
                selectedProgram = match;
                console.log(`[StudyProgram] Matched program: ${match.Code} (${match.Name})`);
            } else {
                console.warn(`[StudyProgram] Custom program '${userParams.studyProgram}' not found. Using first: ${selectedProgram?.Code} (${selectedProgram?.Name})`);
            }
        }
        
        if (!selectedProgram) {
             console.error("[StudyProgram] No programs found to select.");
             return null;
        }

        // STEP 3: Fetch Program Details
        console.log(`[StudyProgram] 2. Fetching Program Details: ${selectedProgram.Link}`);
        const response2 = await fetchWithAuth(selectedProgram.Link);
        const text2 = await response2.text();
        
        const forms = scrapeStudyFormLinks(text2);
        console.log(`[StudyProgram] Found ${forms.length} study forms:`, forms.map((f:any) => f.Form));

        // STEP 4: Select Form (Prezenční vs Kombinovaná)
        let selectedForm = forms.find((f:any) => f.Form.toLowerCase().includes("prezenční")) || forms[0];
        
        if (userParams.studyForm) {
            const formMatch = forms.find((f:any) => f.Form.toLowerCase().includes(userParams.studyForm?.toLowerCase() || ""));
            if (formMatch) selectedForm = formMatch;
        }

        if (!selectedForm) {
            console.error("[StudyProgram] No study forms found.");
            console.log("[StudyProgram] Checking if program link returned the plan directly...");
            const fallbackTable = scrapeStudyPlanRobust(text2);
            if (fallbackTable.length > 0) {
                 console.log(`[StudyProgram] Fallback success: Found ${fallbackTable.length} items directly.`);
                 return {
                    programs,
                    specializations,
                    finalTable: fallbackTable,
                    lastUpdated: Date.now()
                };
            }
            return null;
        }

        // STEP 5: Fetch Final Plan
        console.log(`[StudyProgram] 3. Fetching Final Plan: ${selectedForm.Link}`);
        const response3 = await fetchWithAuth(selectedForm.Link);
        const text3 = await response3.text();
        
        // STEP 6: Scrape Final Table
        const finalTable = scrapeStudyPlanRobust(text3);
        console.log(`[StudyProgram] Final Table Rows: ${finalTable.length}`);
        
        if (finalTable.length === 0) {
            console.warn("[StudyProgram] Final Table is empty.");
        }

        return {
            programs,
            specializations,
            finalTable,
            lastUpdated: Date.now()
        };

    } catch (error) {
        console.error('[StudyProgram] Failed to fetch:', error);
        return null;
    }
}
