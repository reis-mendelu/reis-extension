import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Student Subject Data Scraper', () => {
  // Configuration
  const FACULTY_IDS = [2]; // Restricted to PEF as per user request
  // Added legacy codes (ALG, ICT, TZI) to match older semesters
  const TARGET_COURSES = ['EBC-ALG', 'EBC-ICT', 'EBC-TZI', 'ALG', 'ICT', 'TZI'];
  const MAX_HISTORY_YEARS = 15;
  
  // State
  const results: any[] = [];
  const currentYear = new Date().getFullYear();

  test('scrape subject statistics', async ({ page }) => {
    // Increase timeout for long scraping session
    test.setTimeout(10 * 60 * 1000); // 10 minutes

    console.log(`🚀 Starting scraper (Targeting last ${MAX_HISTORY_YEARS} years)...`);

    for (const facultyId of FACULTY_IDS) {
      console.log(`\n🏫 Processing Faculty ID: ${facultyId}`);
      
      // Level 1: Faculty Selection
      await page.goto(`https://is.mendelu.cz/auth/student/hodnoceni.pl?fakulta=${facultyId};lang=cz`);
      
      // Level 2: Semester Selection
      // Locator: table#tmtab_1
      const semesterTable = page.locator('table#tmtab_1');
      if (await semesterTable.count() === 0) {
        console.log(`   ⚠️ No table found for faculty ${facultyId}`);
        continue;
      }

      // Validation: Header must contain "Název období"
      const semesterHeader = semesterTable.locator('tr.zahlavi th').filter({ hasText: 'Název období' });
      if (await semesterHeader.count() === 0) {
        console.log(`   ⚠️ Invalid table format (missing "Název období") for faculty ${facultyId}`);
        continue;
      }

      // Iterate rows
      const semesterRows = semesterTable.locator('tr.uis-hl-table');
      const semesterCount = await semesterRows.count();
      
      // We need to collect links first to avoid stale element errors during navigation
      const semesterLinks: { name: string, url: string }[] = [];

      for (let i = 0; i < semesterCount; i++) {
        const row = semesterRows.nth(i);
        const nameCell = row.locator('td').nth(1); // Index 1 (2nd cell)
        const linkCell = row.locator('td').nth(4); // Index 4 (5th cell)

        const name = await nameCell.innerText();
        
        // Parse Year: "LS 2024/2025 - PEF" -> 2024
        // Logic: Extract first 4-digit number
        const yearMatch = name.match(/(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          console.log(`   [DEBUG] Year: ${year}`);
          
          if (year < (currentYear - MAX_HISTORY_YEARS)) {
             console.log(`   🛑 Reached history limit (${year}), stopping semester list.`);
             break; 
          }
        } else {
             continue; 
        }

        const linkElement = linkCell.locator('a');
        if (await linkElement.count() > 0) {
            const url = await linkElement.getAttribute('href');
            if (url) {
                const absUrl = new URL(url, page.url()).toString();
                semesterLinks.push({ name: name.trim(), url: absUrl });
            }
        }
      }

      console.log(`   Found ${semesterLinks.length} valid semesters.`);

      // Process Semesters
      for (const semester of semesterLinks) {
        console.log(`   📅 Processing Semester: ${semester.name}`);
        try {
            await page.goto(semester.url);
        } catch (e) {
            console.log(`   ⚠️ Failed to navigate to semester: ${e}`);
            continue;
        }

        // Level 3: Course Selection
        const courseTable = page.locator('table#tmtab_1');
         if (await courseTable.count() === 0) continue;

        // Validation: Header must contain "Kód"
        const courseHeader = courseTable.locator('tr.zahlavi th').filter({ hasText: 'Kód' });
        if (await courseHeader.count() === 0) continue;

        const courseRows = courseTable.locator('tr.uis-hl-table');
        const courseCount = await courseRows.count();
        
        const courseLinks: { code: string, url: string }[] = [];

        for (let j = 0; j < courseCount; j++) {
            const row = courseRows.nth(j);
            const codeCell = row.locator('td').nth(1); // User said td[1]
            const linkCell = row.locator('td').nth(5); // User said td[5]

            const codeText = await codeCell.innerText();
            const normalizedCode = codeText.trim();

            if (TARGET_COURSES.includes(normalizedCode)) {
                 const linkElement = linkCell.locator('a');
                 if (await linkElement.count() > 0) {
                    const url = await linkElement.getAttribute('href');
                    if (url) {
                        const absUrl = new URL(url, page.url()).toString();
                        courseLinks.push({ code: normalizedCode, url: absUrl });
                    }
                 }
            }
        }

        if (courseLinks.length > 0) {
             console.log(`     Found ${courseLinks.length} target courses.`);
        }

        // Process Courses
        for (const course of courseLinks) {
            console.log(`     📚 Processing Course: ${course.code}`);
            await page.goto(course.url); // Navigate to predmet={id}

             // Level 4: Statistics Extraction
             const statsTable = page.locator('table#tmtab_1');
             if (await statsTable.count() === 0) {
                 console.log(`       ⚠️ No stats table found (skipping).`);
                 continue;
             }

             // Validation: Headers "A", "B", "F"
             const headerRow = statsTable.locator('tr.zahlavi');
             const hasA = await headerRow.locator('th', { hasText: 'A' }).count() > 0;
             const hasF = await headerRow.locator('th', { hasText: 'F' }).count() > 0;
             
             if (!hasA || !hasF) {
                 console.log('       ⚠️ Stats table validation failed (headers A/F missing).');
                 continue;
             }

             const statsRows = statsTable.locator('tr.uis-hl-table');
             const statsCount = await statsRows.count();

             let totalPass = 0;
             let totalFail = 0;
             const terms: any[] = [];

             for (let k = 0; k < statsCount; k++) {
                const row = statsRows.nth(k);
                
                const cells = row.locator('td');
                if (await cells.count() < 9) continue;

                const getVal = async (idx: number) => {
                    const txt = await cells.nth(idx).innerText();
                    const val = parseInt(txt.trim(), 10);
                    return isNaN(val) ? 0 : val;
                };

                const termName = (await cells.nth(1).innerText()).trim();
                const a = await getVal(2);
                const b = await getVal(3);
                const c = await getVal(4);
                const d = await getVal(5);
                const e = await getVal(6);
                const f = await getVal(7);
                const fail = await getVal(8);

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
             }

             console.log(`       📊 Stats: Pass=${totalPass}, Fail=${totalFail}`);

             results.push({
                 facultyId,
                 semester: semester.name,
                 course: course.code,
                 totalPass,
                 totalFail,
                 terms,
                 timestamp: new Date().toISOString()
             });

             // Save incrementally
             const outputDir = path.join(__dirname, '..', 'test-results');
             if (!fs.existsSync(outputDir)) {
                 try { fs.mkdirSync(outputDir, { recursive: true }); } catch (e) {}
             }
             const outputPath = path.join(outputDir, 'student-data.json');
             fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        }
      }
    }

    // Save results
    const outputDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'student-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Saved ${results.length} records to ${outputPath}`);
    
    // Allow manual inspection if needed (optional, maybe remove for pure CI)
    // await page.pause(); 
  });
});
