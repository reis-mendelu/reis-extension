// Předměty → Odevzdávárny card, expanded to every open box (#494, #504).
// Seed: data/demo-boxes.json
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Předměty' }).last().click();
  await page.getByRole('button', { name: /otevřených/ }).click();
};
