// Mapa → search Z13 → building Z (FRRMS) indoor plan (#451). Seed: data/demo-map.json
// Zoomed to a room the street map is not drawn (#512), and headless Chromium gets no OSM tiles
// anyway, so the shot is the indoor plan on its own.
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Mapa' }).last().click();
  await page.getByPlaceholder('Najdi místnost, budovu, akci…').click();
  await page.getByPlaceholder('Najdi místnost, budovu, akci…').fill('Z13');
  await page.getByText('Z13', { exact: true }).last().click();
  await page.waitForTimeout(2500);
};
