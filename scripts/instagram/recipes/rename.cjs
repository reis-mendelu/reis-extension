// Předměty → Statistika → pencil → own name typed, before saving (#506). No seed.
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Předměty' }).last().click();
  await page.getByText('Statistika', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Přejmenovat předmět' }).click();
  await page.getByLabel('Tvůj název předmětu').fill('Statka');
};
