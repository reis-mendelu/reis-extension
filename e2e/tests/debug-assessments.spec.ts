/* eslint-disable */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Assessment Diagnostic', () => {
    const SUBJECTS = [
        { code: 'EBC-ALG', id: '159410' },
        { code: 'EBC-TZI', id: '159412' },
        { code: 'EBC-UICT', id: '159413' },
        { code: 'EBC-ZOO', id: '159414' }
    ];

    test('inspect assessment tables', async ({ page }) => {
        // Use credentials from .env if available
        const studium = '149707';
        const obdobi = '801';

        for (const subject of SUBJECTS) {
            const url = `https://is.mendelu.cz/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${subject.id};test=1;lang=cz`;
            console.log(`\n🔍 Inspecting ${subject.code} (${subject.id})...`);
            await page.goto(url);

            // Check for login redirect
            if (page.url().includes('login.pl')) {
                console.log('❌ Redirected to login. Please ensure MENDELU_USER and MENDELU_PASS are set in .env');
                return;
            }

            const table = page.locator('#tmtab_1');
            if (await table.count() === 0) {
                console.log(`⚠️ No #tmtab_1 found for ${subject.code}. Dumping all table IDs:`);
                const allTables = await page.locator('table').evaluateAll(tables => 
                    tables.map(t => ({ id: t.id, class: t.className }))
                );
                console.log(JSON.stringify(allTables, null, 2));
                
                const screenshotPath = path.join(__dirname, '..', 'test-results', `missing-table-${subject.code}.png`);
                await page.screenshot({ path: screenshotPath });
                console.log(`📸 Screenshot saved to ${screenshotPath}`);
                continue;
            }

            // Inspect headers
            const headers = await table.locator('thead th').evaluateAll(ths => 
                ths.map(th => th.textContent?.trim() || '')
            );
            console.log(`✅ Table found. Headers: ${headers.join(' | ')}`);

            // Inspect rows
            const rows = table.locator('tr.uis-hl-table');
            const rowCount = await rows.count();
            console.log(`📊 Found ${rowCount} rows with class .uis-hl-table`);

            if (rowCount > 0) {
                const firstRowCols = await rows.first().locator('td').evaluateAll(tds => 
                    tds.map(td => td.textContent?.trim() || '')
                );
                console.log(`📝 First row data: ${firstRowCols.join(' | ')}`);
            } else {
                 const anyRows = await table.locator('tr').count();
                 console.log(`⚠️ 0 .uis-hl-table rows, but ${anyRows} total rows in table.`);
                 if (anyRows > 1) {
                     const firstDataRow = await table.locator('tr').nth(1).locator('td').evaluateAll(tds => 
                        tds.map(td => td.textContent?.trim() || '')
                    );
                    console.log(`📝 First data row (any class): ${firstDataRow.join(' | ')}`);
                 }
            }

            const screenshotPath = path.join(__dirname, '..', 'test-results', `assessment-${subject.code}.png`);
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved to ${screenshotPath}`);
        }
    });
});
