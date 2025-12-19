import { Actor, Cast, TakeNotes } from '@serenity-js/core';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { BrowserContext, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, '../../dist');
const USER_DATA_DIR = path.resolve(__dirname, '../../.playwright-user-data');
const STORAGE_STATE_PATH = path.resolve(__dirname, '../../storageState.json');

export class ExtensionCast implements Cast {
    constructor(private readonly context: BrowserContext) {}

    prepare(actor: Actor): Actor {
        // Serenity/JS 3.x sometimes fails to distinguish between Browser and BrowserContext
        // if the object doesn't have the expected methods. For persistent contexts (extensions),
        // we provide a wrapper that satisfies the 'Browser' interface.
        const mockBrowser = {
            newContext: async () => this.context,
            contexts: () => [this.context],
            isConnected: () => true,
            close: async () => this.context.close(),
            browserType: () => chromium,
            version: () => 'latest',
        };

        return actor.whoCan(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            BrowseTheWebWithPlaywright.using(mockBrowser as any),
            TakeNotes.usingAnEmptyNotepad(),
        );
    }
}

export async function createExtensionContext(): Promise<BrowserContext> {
    if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error(
        `Extension not found at ${EXTENSION_PATH}. Run "npm run build:quick" first.`
      );
    }

    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    if (fs.existsSync(STORAGE_STATE_PATH)) {
      const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
      if (storageState.cookies && storageState.cookies.length > 0) {
        await context.addCookies(storageState.cookies);
      }
    }

    return context;
}
