import { describe, it, beforeAll, afterAll } from '@serenity-js/playwright-test';
import { actorCalled, engage } from '@serenity-js/core';
import { Wait } from '@serenity-js/core';
import { Ensure, equals, includes } from '@serenity-js/assertions';
import { Page } from '@serenity-js/web';
import { ExtensionCast, createExtensionContext } from '../actors';
import { OpenExtensionPopup, WaitForHydration } from '../tasks';
import { BrowserContext } from '@playwright/test';
import { calculateExtensionId } from '../../utils/id';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Extension Smoke Test', () => {
    let context: BrowserContext;
    
    // Calculate ID from manifest key
    const manifestPath = path.resolve(__dirname, '../../../public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const EXTENSION_ID = calculateExtensionId(manifest.key);

    beforeAll(async () => {
        context = await createExtensionContext();

        // Mock network requests to prevent 401 redirects and simulate auth
        await context.route('**/auth/student/studium.pl*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `<html><body>
                        Link: <a href="...?studium=12345;obdobi=999">Parameters</a>
                        <td>Identifikační číslo uživatele: </td><td class="odsazena" align="left">1001</td>
                        <div id="prihlasen">Přihlášen:&nbsp;Test User</div>
                       </body></html>`
            });
        });

        await context.route('**/auth/student/moje_studium.pl*', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `<html><body><a href="?fakulta=1">Harmonogram</a></body></html>`
            });
        });

        await context.route('**/auth/wifi/certifikat.pl*', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `<html><body>pro uživatele <b>user.name</b></body></html>`
            });
        });

        await context.route('**/auth/katalog/rozvrhy_view.pl*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ blockLessons: [] })
            });
        });

        engage(new ExtensionCast(context));
    });

    afterAll(async () => {
        if (context) {
            await context.close();
        }
    });

    it('should load the extension popup', async () => {
        await actorCalled('Charlie').attemptsTo(
            OpenExtensionPopup(EXTENSION_ID),
            WaitForHydration(),
            Ensure.that(Page.current().title(), equals('reIS'))
        );
    });
});
