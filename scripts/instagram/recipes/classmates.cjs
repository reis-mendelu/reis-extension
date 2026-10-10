// Předměty → Statistika → Spolužáci → Celý předmět: everyone taking the subject, not just your
// cvičení (#490, #505). Seed: data/demo-classmates.json (the demo has no subjects or classmates).
// The toggle is role=tab today; open PR #523 turns it into aria-pressed buttons, so accept both.
module.exports = async (page) => {
  await page.getByRole('button', { name: 'Předměty' }).last().click();
  await page.getByText('Statistika', { exact: true }).first().click();
  await page.getByRole('button', { name: /Spolužáci/ }).click();
  const tab = page.getByRole('tab', { name: 'Celý předmět' });
  const btn = page.getByRole('button', { name: 'Celý předmět' });
  await ((await tab.count()) ? tab : btn).first().click();
  await page.getByText(/Všichni, kdo předmět studují · \d+/).waitFor();
  const n = await page.evaluate(() => {
    const s = window.__reisStore.getState();
    return [s.classmates['DEM-STA']?.length ?? 0, s.subjectClassmates['DEM-STA']?.length ?? 0];
  });
  if (!n[0] || n[1] < 100)
    throw new Error(`classmates seed did not stick: seminar ${n[0]}, subject ${n[1]}`);
};
