// Calendar in week view, chosen the way a student does it: Profil → Nastavení → Týden (#493, #528).
// Seed: data/demo-week.json
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Profil' }).last().click();
  await page.getByText('Nastavení', { exact: true }).click();
  await page.getByRole('button', { name: 'Týden', exact: true }).click();
  await page.getByRole('button', { name: 'Zavřít' }).click();
  await page.getByRole('button', { name: 'Kalendář' }).last().click();
};
