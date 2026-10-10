// Calendar in its default day view. Seed: optional data/demo-week.json
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Kalendář' }).last().click();
};
