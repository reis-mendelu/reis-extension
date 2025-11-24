const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { chromium } = require('@playwright/test');

async function inspectFolders() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const username = process.env.MENDELU_USER;
    const password = process.env.MENDELU_PASS;

    if (!username || !password) {
        console.error('❌ Missing credentials in .env file');
        await browser.close();
        return;
    }

    // Login
    await page.goto('https://is.mendelu.cz/auth/login.pl');
    await page.fill('input[name="credential_0"]', username);
    await page.fill('input[name="credential_1"]', password);
    await page.click('input[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Go to Subjects List
    await page.goto('https://is.mendelu.cz/auth/student/list.pl');

    // Find subjects
    const subjectsOfInterest = ['ZOO', 'ICT', 'TZI'];
    const subjectLinks = {};

    // Extract all rows
    const rows = await page.$$('tr');
    for (const row of rows) {
        const text = await row.innerText();
        for (const subj of subjectsOfInterest) {
            if (text.includes(subj)) {
                // Find the document server link (usually has an icon or 'slozka.pl')
                const link = await row.$('a[href*="slozka.pl"]');
                if (link) {
                    const href = await link.getAttribute('href');
                    subjectLinks[subj] = href;
                }
            }
        }
    }

    // Inspect each folder
    for (const [subj, link] of Object.entries(subjectLinks)) {
        const fullUrl = link.startsWith('http') ? link : `https://is.mendelu.cz/auth/student/${link}`; // Note: list.pl links might be relative to student/
        // Actually, slozka.pl is usually in dok_server. Let's check the href.
        // If it starts with '../', resolve it.
        // Easiest is to let browser handle it by clicking or constructing absolute URL if we knew base.
        // But we can just construct it carefully.

        let targetUrl = fullUrl;
        if (!targetUrl.startsWith('http')) {
            // list.pl is in /auth/student/
            // link might be "../dok_server/slozka.pl..."
            if (targetUrl.startsWith('../')) {
                targetUrl = `https://is.mendelu.cz/auth/${targetUrl.replace('../', '')}`;
            } else {
                targetUrl = `https://is.mendelu.cz/auth/student/${targetUrl}`;
            }
        }

        await page.goto(targetUrl);

        // Dump table rows
        const folderRows = await page.$$eval('tr', (trs) => {
            return trs.map(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                const link = tr.querySelector('a[href*="slozka.pl"]');
                const download = tr.querySelector('a[href*="download"]');
                return {
                    text: tr.innerText.replace(/\n/g, ' | ').substring(0, 100),
                    cellCount: cells.length,
                    hasFolderLink: !!link,
                    hasDownloadLink: !!download,
                    folderLinkText: link ? link.innerText : null,
                    folderLinkHref: link ? link.getAttribute('href') : null,
                    html: tr.innerHTML.substring(0, 200) // First 200 chars of HTML
                };
            });
        });

        // If ICT or TZI, try to go deeper into one subfolder
        if ((subj === 'ICT' || subj === 'TZI') && folderRows.some(r => r.hasFolderLink)) {
            const subfolderRow = folderRows.find(r =>
                r.hasFolderLink &&
                !r.text.includes('Všechny moje složky') &&
                !r.text.includes('Nadřazená složka') &&
                !r.text.includes('Zobrazení dokumentů') &&
                !r.text.includes('Strom od složky') &&
                !r.text.includes('Display documents') &&
                !r.text.includes('Tree starting from folder')
            );

            if (subfolderRow) {
                let subUrl = subfolderRow.folderLinkHref;
                if (!subUrl.startsWith('http')) {
                    subUrl = `https://is.mendelu.cz/auth/dok_server/${subUrl}`; // Assuming relative to dok_server now
                }
                await page.goto(subUrl);

                const subRows = await page.$$eval('tr', (trs) => {
                    return trs.map(tr => {
                        const cells = Array.from(tr.querySelectorAll('td'));
                        const download = tr.querySelector('a[href*="download"]');
                        return {
                            text: tr.innerText.replace(/\n/g, ' | ').substring(0, 100),
                            cellCount: cells.length,
                            hasDownloadLink: !!download
                        };
                    });
                });
            }
        }
    }

    await browser.close();
}

if (require.main === module) {
    inspectFolders().catch(console.error);
}
