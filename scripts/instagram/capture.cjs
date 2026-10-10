// Phone-size still of the reIS DEMO build, for a feed post's phone mockup.
// Usage: node scripts/instagram/capture.cjs <baseUrl> <recipe> <out.png> [seed.json]
const { chromium } = require('@playwright/test');
const { openDemo, assertClean } = require('./lib/demoPage.cjs');

const recipes = {
  // Calendar in week view, chosen the way a student does it: Profil → Nastavení → Týden.
  week: async (page) => {
    await page.getByRole('button', { name: 'Profil' }).last().click();
    await page.getByText('Nastavení', { exact: true }).click();
    await page.getByRole('button', { name: 'Týden', exact: true }).click();
    await page.getByRole('button', { name: 'Zavřít' }).click();
    await page.getByRole('button', { name: 'Kalendář' }).last().click();
  },
  // Předměty → Odevzdávárny card, expanded to every open box (#494, #504).
  boxes: async (page) => {
    await page.getByRole('button', { name: 'Předměty' }).last().click();
    await page.getByRole('button', { name: /otevřených/ }).click();
  },
  // Mapa → search Z13 → building Z (FRRMS) indoor plan (#451).
  mapZ: async (page) => {
    await page.getByRole('button', { name: 'Mapa' }).last().click();
    await page.getByPlaceholder('Najdi místnost, budovu, akci…').click();
    await page.getByPlaceholder('Najdi místnost, budovu, akci…').fill('Z13');
    await page.getByText('Z13', { exact: true }).last().click();
    // Zoomed to the room the street map is not drawn (#512) and headless Chromium gets no
    // tiles anyway, so the shot is the indoor plan on its own — which is the point of the post.
    await page.waitForTimeout(2500);
  },
  // Předměty → Statistika → pencil → own name (#506).
  rename: async (page) => {
    await page.getByRole('button', { name: 'Předměty' }).last().click();
    await page.getByText('Statistika', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Přejmenovat předmět' }).click();
    await page.getByLabel('Tvůj název předmětu').fill('Statka');
  },
  day: async (page) => {
    await page.getByRole('button', { name: 'Kalendář' }).last().click();
  },
};

(async () => {
  const [base, recipeName, out, seedPath] = process.argv.slice(2);
  const recipe = recipes[recipeName];
  if (!recipe) throw new Error(`unknown recipe ${recipeName}; have ${Object.keys(recipes)}`);
  const browser = await chromium.launch();
  const page = await openDemo(browser, base, { seedPath });
  await recipe(page);
  await page.waitForTimeout(1200);
  await assertClean(page);
  await page.screenshot({ path: out });
  console.log('captured', recipeName, '→', out);
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
