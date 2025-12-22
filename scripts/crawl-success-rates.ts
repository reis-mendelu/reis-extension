import { chromium } from '@playwright/test';
import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as db from '../server/db';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://is.mendelu.cz';
const LOGIN_URL = `${BASE_URL}/system/login.pl`;
const STATS_URL = `${BASE_URL}/auth/student/hodnoceni.pl`;

// Correct faculty IDs from spec
const FACULTIES = [
  { id: '2', name: 'PEF' },
  { id: '14', name: 'Agronomická' },
  { id: '23', name: 'FRRMS' },
  { id: '38', name: 'LDF' },
  { id: '60', name: 'Zahradnická' },
  { id: '220', name: 'ICV' },
];

const MAX_HISTORY_YEARS = 15;

async function run() {
  const args = process.argv.slice(2);
  const facultyFilter = args.find(a => a.startsWith('--faculty='))?.split('=')[1];
  const resume = args.includes('--resume');
  const limitCount = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const maxCourses = limitCount ? parseInt(limitCount, 10) : Infinity;

  console.log('🚀 Starting Success Rate Crawler...');
  if (facultyFilter) console.log(`🎯 Filtering by faculty: ${facultyFilter}`);
  if (resume) console.log('♻️  Resume mode enabled');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let scrapedTotal = 0;

  try {
    // 1. Login
    console.log('🔑 Logging in...');
    await page.goto(LOGIN_URL);
    await page.fill('input[name="credential_0"]', process.env.MENDELU_USER || '');
    await page.fill('input[name="credential_1"]', process.env.MENDELU_PASS || '');
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in successfully');

    const currentYear = new Date().getFullYear();

    // 2. Iterate Faculties
    for (const faculty of FACULTIES) {
      if (facultyFilter && faculty.name !== facultyFilter && faculty.id !== facultyFilter) continue;

      console.log(`\n🏢 Processing Faculty: ${faculty.name} (${faculty.id})`);
      db.upsertFaculty(parseInt(faculty.id, 10), faculty.name);
      
      await page.goto(`${STATS_URL}?fakulta=${faculty.id};lang=cz`);
      await page.waitForLoadState('networkidle');

      // Level 2: Find semesters
      const semesterLinks = await page.evaluate(() => {
        const table = document.querySelector('table#tmtab_1');
        if (!table) return [];
        
        const results: { name: string; url: string; id: string; year: number }[] = [];
        const rows = table.querySelectorAll('tr.uis-hl-table');
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 5) return;
          
          const nameCell = cells[1];
          const linkCell = cells[4];
          
          const name = nameCell?.textContent?.trim() || '';
          const link = linkCell?.querySelector('a');
          const href = link?.getAttribute('href') || '';
          
          const yearMatch = name.match(/(\d{4})\/\d{4}/);
          const idMatch = href.match(/obdobi=(\d+)/);
          
          if (yearMatch && idMatch) {
            results.push({
              name,
              url: href,
              id: idMatch[1],
              year: parseInt(yearMatch[1], 10)
            });
          }
        });
        return results;
      });

      const validSemesters = semesterLinks.filter(s => s.year >= currentYear - MAX_HISTORY_YEARS);
      console.log(`📅 Found ${validSemesters.length} relevant semesters`);

      for (const sem of validSemesters) {
        console.log(`  🔍 Processing Semester: ${sem.name}`);
        const semesterId = parseInt(sem.id, 10);
        db.upsertSemester(semesterId, parseInt(faculty.id, 10), sem.name, sem.year);

        const fullUrl = sem.url.startsWith('http') 
          ? sem.url 
          : `${BASE_URL}/auth/student/${sem.url}`;
        await page.goto(fullUrl);
        await page.waitForLoadState('networkidle');

        // DEBUG: Save first semester HTML for analysis
        if (sem === validSemesters[0]) {
          const semHtml = await page.content();
          await writeFile(`debug-semester-${faculty.id}.html`, semHtml);
          console.log(`    📸 Saved debug-semester-${faculty.id}.html`);
        }

        // Level 3: Find courses
        const courses = await page.evaluate(() => {
          const table = document.querySelector('table#tmtab_1');
          if (!table) return [];
          const results: { code: string; name: string; predmetId: string }[] = [];
          const rows = table.querySelectorAll('tr.uis-hl-table');
          
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            
            let code = cells[1]?.textContent?.trim() || '';
            let name = cells[2]?.textContent?.trim() || '';
            let predmetId = '';
            
            const link = row.querySelector('a[href*="predmet="]');
            if (link) {
              const href = link.getAttribute('href') || '';
              const idMatch = href.match(/predmet=(\d+)/);
              if (idMatch) predmetId = idMatch[1];
            }
            
            if (code && predmetId) {
              results.push({ code, name, predmetId });
            }
          });
          return results;
        });

        console.log(`    📚 Found ${courses.length} courses in semester`);

        for (const course of courses) {
          if (scrapedTotal >= maxCourses) break;

          // Check if already scraped in resume mode
          const courseId = db.upsertCourse(course.code, course.name, course.predmetId);
          
          if (resume) {
             // Basic resume logic: if we already have stats for this course in this semester, skip
             // A more advanced one would check last_scraped timestamp
             const existing = db.getSuccessRatesByCourse(course.code);
             if (existing && existing.stats.some((s: any) => s.semesterName === sem.name)) {
                // console.log(`      ⏭️  Skipping ${course.code} (already in DB)`);
                continue;
             }
          }

          try {
            const statsUrl = `${STATS_URL}?fakulta=${faculty.id};obdobi=${sem.id};predmet=${course.predmetId};lang=cz`;
            await page.goto(statsUrl, { waitUntil: 'domcontentloaded' });

            const pageHtml = await page.content();
            const tableMatch = pageHtml.match(/<table[^>]*id="tmtab_1"[^>]*>[\s\S]*?<\/table>/);
            const tableHtml = tableMatch ? tableMatch[0] : null;

            if (!tableHtml) continue;

            const cleanHtml = tableHtml.replace(/\s+/g, ' ');
            if (!cleanHtml.includes('>A<') || !cleanHtml.includes('>B<') || !cleanHtml.includes('>F<')) {
               continue;
            }

            // Use NVD3 chart parsing for aggregate "Všechny termíny" (Final Outcome)
            const chartRegex = /d3\.select\('#graph_\d+ svg'\)\s*\.datum\(\[\s*\{\s*values:\s*\[\s*([\s\S]*?)\]\s*}\s*,?\s*\]\)/;
            const match = pageHtml.match(chartRegex);
            
            if (match && match[1]) {
                const valuesStr = match[1];
                const valueRegex = /\{\s*x:\s*['"]([^'"]+)['"],\s*y:\s*(\d+)\s*}/g;
                const grades: any = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 };
                let vm;
                while ((vm = valueRegex.exec(valuesStr)) !== null) {
                    const grade = vm[1];
                    const count = parseInt(vm[2], 10);
                    if (grade === 'A') grades.A = count;
                    else if (grade === 'B') grades.B = count;
                    else if (grade === 'C') grades.C = count;
                    else if (grade === 'D') grades.D = count;
                    else if (grade === 'E') grades.E = count;
                    else if (grade === 'F') grades.F = count;
                    else if (grade === 'zk-nedost' || grade === 'FN' || grade.toLowerCase().includes('nedost')) grades.FN = count;
                    else if (grade === 'zap-nedost') grades.FN = count;
                }

                // Insert as a single "Všechny termíny" record (Final Outcome)
                db.insertSuccessRate(courseId, semesterId, 'Všechny termíny', grades, statsUrl);
                scrapedTotal++;
                console.log(`      ✅ Scraped ${course.code} (N=${Object.values(grades).reduce((a: any, b: any) => a + b, 0)}) [${scrapedTotal}/${maxCourses > 10000 ? '?' : maxCourses}]`);
                db.markCourseScraped(course.code);
            } else {
                // Fallback to table parsing if chart not found (older IS pages or different layout)
                const rowMatches = cleanHtml.match(/<tr class="[^"]*uis-hl-table[^"]*">(.*?)<\/tr>/g);
                if (rowMatches) {
                    let courseHasStats = false;
                    for (const rowHtml of rowMatches) {
                        const cells = rowHtml.match(/<td[^>]*>(.*?)<\/td>/g);
                        if (!cells || cells.length < 9) continue;
                        
                        const getCellText = (cell: string) => cell.replace(/<[^>]*>/g, '').trim();
                        const getCellVal = (cell: string) => {
                            const val = parseInt(getCellText(cell) || '0', 10);
                            return isNaN(val) ? 0 : val;
                        };

                        const termName = getCellText(cells[1]);
                        const grades = {
                            A: getCellVal(cells[2]),
                            B: getCellVal(cells[3]),
                            C: getCellVal(cells[4]),
                            D: getCellVal(cells[5]),
                            E: getCellVal(cells[6]),
                            F: getCellVal(cells[7]),
                            FN: getCellVal(cells[8])
                        };

                        if (grades.A || grades.B || grades.C || grades.D || grades.E || grades.F || grades.FN) {
                            db.insertSuccessRate(courseId, semesterId, termName, grades, statsUrl);
                            courseHasStats = true;
                        }
                    }
                    if (courseHasStats) {
                        scrapedTotal++;
                        console.log(`      ✅ Scraped ${course.code} [${scrapedTotal}/${maxCourses > 10000 ? '?' : maxCourses}]`);
                        db.markCourseScraped(course.code);
                    }
                }
            }
          } catch (e: any) {
            console.error(`      ❌ Error processing course ${course.code}:`, e.message);
          }
        }
        db.markSemesterScraped(semesterId);
        if (scrapedTotal >= maxCourses) break;
      }
      if (scrapedTotal >= maxCourses) break;
    }

    console.log(`\n✨ Finished! Total courses scraped/updated: ${scrapedTotal}`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    db.closeDb();
    await browser.close();
  }
}

run();
