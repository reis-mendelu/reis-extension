// Předměty → Statistika → Záznamník: each submission box shows the teacher's Pokyny (#575).
// Seed: data/demo-pokyny.json (also seeds the subject, without which the sheet disables Záznamník).
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Předměty' }).last().click();
  await page.getByText('Statistika', { exact: true }).first().click();
  const tab = page.getByRole('tab', { name: /Záznamník/ });
  const btn = page.getByRole('button', { name: /Záznamník/ });
  await ((await tab.count()) ? tab : btn).first().click();
  await page.getByText('Pokyny', { exact: true }).first().click();
  await page.getByText(/Data přiložte jako/).waitFor();
};
