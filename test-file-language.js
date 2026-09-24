/**
 * Playwright script to test file fetching in Czech vs English
 *
 * This script logs into IS Mendelu and fetches file listings
 * in both languages to verify that lang parameter affects file names.
 */

import { chromium } from 'playwright';

const TEST_SUBJECTS = [
  { code: 'EBC-ALG', folderId: '150953', name: 'Algorithmization' },
  { code: 'EBC-KOM', folderId: '150180', name: 'Communications' },
  { code: 'EBC-AP', folderId: '150954', name: 'Computer Architecture' },
];

async function fetchFolderContent(page, folderId, lang) {
  const url = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId};lang=${lang}`;
  console.log(`\nFetching: ${url}`);

  await page.goto(url, { waitUntil: 'networkidle' });

  // Extract file information from the table
  const files = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('tr.uis-hl-table');

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      // Adjust for checkbox column if present
      const hasCheckbox = cells[0]?.querySelector('input[type="checkbox"]');
      const offset = hasCheckbox ? 1 : 0;

      const subfolder = cells[offset]?.textContent?.trim() || '';
      const fileName = cells[1 + offset]?.textContent?.trim() || '';
      const comment = cells[2 + offset]?.textContent?.trim() || '';

      if (fileName && fileName.length > 0) {
        results.push({ subfolder, fileName, comment });
      }
    });

    return results;
  });

  return files;
}

async function main() {
  console.log('🚀 Starting File Language Test\n');
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to IS Mendelu login
    console.log('\n📝 Navigating to IS Mendelu...');
    await page.goto('https://is.mendelu.cz/auth/');

    // Wait for login (manual login required)
    console.log('\n⏸️  Please log in manually in the browser window...');
    console.log('   Waiting for navigation to student portal...');

    await page.waitForURL('**/auth/**', { timeout: 120000 });
    console.log('✅ Login successful!\n');

    // Test each subject
    for (const subject of TEST_SUBJECTS) {
      console.log('\n' + '='.repeat(80));
      console.log(`📚 Testing: ${subject.code} - ${subject.name}`);
      console.log('='.repeat(80));

      // Fetch in Czech
      console.log('\n🇨🇿 Czech Version (lang=cz)');
      const czechFiles = await fetchFolderContent(page, subject.folderId, 'cz');
      console.log(`Found ${czechFiles.length} files`);
      if (czechFiles.length > 0) {
        console.log('Sample files:');
        czechFiles.slice(0, 5).forEach((f, i) => {
          console.log(`  ${i + 1}. ${f.fileName}`);
          if (f.comment) console.log(`     Comment: ${f.comment}`);
        });
      }

      // Wait a bit to avoid rate limiting
      await page.waitForTimeout(1000);

      // Fetch in English
      console.log('\n🇬🇧 English Version (lang=en)');
      const englishFiles = await fetchFolderContent(page, subject.folderId, 'en');
      console.log(`Found ${englishFiles.length} files`);
      if (englishFiles.length > 0) {
        console.log('Sample files:');
        englishFiles.slice(0, 5).forEach((f, i) => {
          console.log(`  ${i + 1}. ${f.fileName}`);
          if (f.comment) console.log(`     Comment: ${f.comment}`);
        });
      }

      // Compare
      console.log('\n🔍 Comparison:');
      console.log(`  Czech files: ${czechFiles.length}`);
      console.log(`  English files: ${englishFiles.length}`);

      if (czechFiles.length > 0 && englishFiles.length > 0) {
        const sampleCz = czechFiles[0];
        const sampleEn = englishFiles[0];

        console.log('\n  First file comparison:');
        console.log(`    CZ: "${sampleCz.fileName}"`);
        console.log(`    EN: "${sampleEn.fileName}"`);
        console.log(
          `    Different: ${sampleCz.fileName !== sampleEn.fileName ? '✅ YES' : '❌ NO'}`
        );
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test complete!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    console.log('\n⏸️  Press Ctrl+C to close browser and exit...');
    // Keep browser open for manual inspection
    await new Promise(() => {});
  }
}

main();
