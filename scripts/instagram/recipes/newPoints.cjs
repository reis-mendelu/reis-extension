// Novinky (bell) → the "Nové body" section: subjects whose záznamník got new points (#581).
// Seed: data/demo-newpoints.json. Society posts come from Supabase; where that is unreachable the
// feed would sit on "Načítá se…", so mark it loaded (empty) as it is on a device with no new posts.
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Kalendář' }).last().click();
  await page
    .getByRole('button', { name: /Novinky|Oznámení/ })
    .first()
    .click();
  await page.getByText('Průběžný test 2: 18/20').waitFor();
  await page.waitForTimeout(800);
  await page.evaluate(() =>
    window.__reisStore.setState((s) => ({
      notifications: { ...s.notifications, data: [], status: 'success' },
    }))
  );
  await page
    .getByText('Načítá se')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
};
