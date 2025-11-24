import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function globalSetup(config: FullConfig) {
  const { storageState } = config.projects[0].use;
  const username = process.env.MENDELU_USER;
  const password = process.env.MENDELU_PASS;
  const browser = await chromium.launch();

  if (!username || !password) {
    console.warn('⚠️  No credentials provided (MENDELU_USER/MENDELU_PASS). Skipping login.');
    // Create empty storage state to prevent ENOENT error
    const page = await browser.newPage();
    await page.context().storageState({ path: storageState as string });
    await browser.close();
    return;
  }

  console.log('🔐 Global Setup: Authenticating...');
  const page = await browser.newPage();

  try {
    await page.goto('https://is.mendelu.cz/auth/login.pl');

    // Check if already logged in (redirected)
    if (page.url().includes('/auth/') && !page.url().includes('login.pl')) {
        console.log('   ✅ Already logged in.');
    } else {
        await page.fill('input[name="credential_0"]', username);
        await page.fill('input[name="credential_1"]', password);
        await page.click('input[type="submit"]');
        await page.waitForLoadState('networkidle');
        
        // Wait for redirect to auth area
        try {
            await page.waitForURL('**/auth/**', { timeout: 15000 });
            console.log('   ✅ Login successful!');
        } catch (e) {
            console.warn('   ⚠️  Login might have failed or timed out.');
        }
    }

    await page.context().storageState({ path: storageState as string });
    console.log('   💾 Session saved to ' + storageState);
    
  } catch (error) {
    console.error('❌ Global Setup failed:', error);
  } finally {
    console.log('   🛑 Closing browser...');
    await browser.close();
    console.log('   ✨ Global Setup finished.');
  }
}

export default globalSetup;
