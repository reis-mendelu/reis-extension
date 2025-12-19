import { describe, it, beforeAll, afterAll } from '@serenity-js/playwright-test';
import { actorCalled, engage } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
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
