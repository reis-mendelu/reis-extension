// Profil → Studium: the switcher between a student's two studies (#572).
// Seed: data/demo-studies.json
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Profil' }).last().click();
  const group = page.getByRole('group', { name: 'Studium' }).first();
  await group.waitFor();
  await group.scrollIntoViewIfNeeded();
  if (!/FRRMS/.test(await group.innerText())) throw new Error('seed did not stick');
};
