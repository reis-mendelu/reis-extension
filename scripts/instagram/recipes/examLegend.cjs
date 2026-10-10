// Zkoušky → Statistika expanded: term rows with Ř/1/2 badges and the term-type legend under them (#483, badges #401).
// Seed: data/demo-exam-legend.json
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Zkoušky' }).last().click();
  await page.getByRole('button', { name: /^Statistika/ }).click();
  const legend = page.getByRole('list', { name: 'Typy termínů' }).first();
  await legend.waitFor();
  const text = await legend.innerText();
  if (!/2\. opravný/.test(text)) throw new Error(`seed did not stick, legend reads: ${text}`);
};
