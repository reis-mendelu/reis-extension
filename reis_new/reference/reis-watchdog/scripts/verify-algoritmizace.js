require('dotenv').config();
const { chromium } = require('@playwright/test');
const { performLogin } = require('./discover-forms'); // Reuse login logic if possible, or copy it

// URL for Algoritmizace folder (from user request)
// https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=150953;lang=cz
const TARGET_URL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=150953;lang=cz';

async function verifyAlgoritmizace() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log('🔍 Starting Algoritmizace verification...\n');

    const username = process.env.MENDELU_USER;
    const password = process.env.MENDELU_PASS;

    if (!username || !password) {
        console.error('❌ Missing credentials in .env file');
        await browser.close();
        return;
    }

    // Login
    // We need to copy performLogin or export it from discover-forms.js
    // Since I can't easily modify discover-forms.js to export it without potentially breaking things (though I could),
    // I'll just inline a simplified version here for safety and speed.

    console.log('🔐 Attempting login...');
    await page.goto('https://is.mendelu.cz/auth/login.pl');
    await page.fill('input[name="credential_0"]', username);
    await page.fill('input[name="credential_1"]', password);
    await page.click('input[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Navigate to target folder
    console.log(`📂 Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL);

    // Wait for table
    try {
        await page.waitForSelector('table', { timeout: 10000 });
    } catch (e) {
        console.error('❌ Timeout waiting for table');
        await page.screenshot({ path: 'error-screenshot.png' });
        await browser.close();
        return;
    }

    // Extract rows
    const rows = await page.$$eval('tr', (trs) => {
        return trs.map(tr => {
            const cells = Array.from(tr.querySelectorAll('td'));
            return {
                cellCount: cells.length,
                text: tr.innerText.replace(/\n/g, ' | ').substring(0, 100),
                html: tr.innerHTML
            };
        });
    });

    console.log(`\n📊 Found ${rows.length} rows total.`);

    // Filter for likely file rows (heuristic from our analysis)
    const fileRows = rows.filter(r => r.cellCount >= 5);
    console.log(`   Found ${fileRows.length} potential file rows (>= 5 cells).`);

    fileRows.forEach((r, i) => {
        console.log(`   Row ${i}: [Cells: ${r.cellCount}] ${r.text}`);
    });

    // Find and log pagination row specifically
    const paginationRow = rows.find(r => r.text.match(/\d+-\d+/) && (r.text.includes('1-10') || r.text.includes('11-20')));
    if (paginationRow) {
        console.log('\n📄 Pagination Row Detected:');
        console.log(`Text: ${paginationRow.text}`);
        console.log(`HTML: ${paginationRow.html}`);
    } else {
        console.log('\n⚠️ No pagination row detected with pattern /\\d+-\\d+/');
    }

    // Test parsing logic
    console.log('\n🧪 Testing Parsing Logic:');
    const paginationLinks = [];
    rows.forEach(r => {
        // Simulate text content check
        if (r.text.match(/\d+-\d+/)) {
            console.log(`   Matches /\\d+-\\d+/: "${r.text.trim()}"`);

            // Simulate link check
            // We need to check if HTML contains the link
            if (r.html.includes('slozka.pl')) {
                console.log('   Contains "slozka.pl" in HTML');
                // Extract links
                const matches = r.html.match(/href="([^"]*slozka\.pl[^"]*)"/g);
                if (matches) {
                    matches.forEach(m => {
                        const href = m.match(/href="([^"]*)"/)[1];
                        if (!href.includes('download')) {
                            console.log(`   Found pagination link: ${href}`);
                            paginationLinks.push(href);
                        }
                    });
                }
            }
        }
    });

    console.log(`\nFound ${paginationLinks.length} pagination links total.`);

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'algoritmizace-folder.png', fullPage: true });
    console.log('\n📸 Screenshot saved to algoritmizace-folder.png');

    await browser.close();
}

if (require.main === module) {
    verifyAlgoritmizace().catch(console.error);
}
