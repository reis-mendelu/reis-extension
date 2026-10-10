// Phone-size still of the reIS DEMO build, for a feed post's phone mockup.
// Usage: node scripts/instagram/capture.cjs <baseUrl> <recipe> <out.png> [seed.json]
// A recipe is recipes/<name>.cjs: an async (page) => {} that taps to the screen like a student would.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openDemo, assertClean } = require('./lib/demoPage.cjs');

(async () => {
  const [base, recipeName, out, seedPath] = process.argv.slice(2);
  const file = path.join(__dirname, 'recipes', `${recipeName}.cjs`);
  if (!fs.existsSync(file)) {
    const have = fs
      .readdirSync(path.join(__dirname, 'recipes'))
      .map((f) => f.replace(/\.cjs$/, ''));
    throw new Error(`no recipe ${recipeName}; have ${have.join(', ')}`);
  }
  const recipe = require(file);
  const browser = await chromium.launch();
  const page = await openDemo(browser, base, { seedPath });
  await recipe(page);
  await page.waitForTimeout(1200);
  await assertClean(page);
  await page.screenshot({ path: out });
  console.log('captured', recipeName, '→', out);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
