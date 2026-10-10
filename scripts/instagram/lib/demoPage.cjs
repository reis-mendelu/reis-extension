// Open the reIS DEMO build at phone size, seed it, and strip what must not appear in a post.
// Shared by capture.cjs (stills) and record.cjs (Reel footage).
//
// Privacy: refuses to continue unless the page is the demo dataset ("Ukázka" bar, demo user
// "Jana Ukázková"), so a dev:web run on someone's real IS snapshot can never be captured.
// Partners: the Profil tab's "Spolupracujeme s firmami" block (partner logos) is removed and
// asserted gone — a partner's mark must not appear in a reIS post unless that is cleared.

const fs = require('fs');

function lessonsFromSeed(seed) {
  return seed.lessons.map(([day, start, end, name, code, room, t, seminar], i) => {
    const d = new Date(seed.monday + 'T12:00:00');
    d.setDate(d.getDate() + day);
    return {
      id: `mk-${i}`, date: d.toISOString().slice(0, 10).replaceAll('-', ''), startTime: start, endTime: end,
      courseCode: code, courseName: name, room, roomStructured: { name: room, id: room.toLowerCase() },
      teachers: [seed.teachers[t]], isExam: false, isConsultation: 'false', studyId: '', facultyCode: 'PEF',
      isDefaultCampus: 'true', courseId: code.toLowerCase(), campus: 'Brno', isSeminar: String(seminar), periodId: '',
    };
  });
}

async function openDemo(browser, base, { seedPath, deviceScaleFactor = 3 } = {}) {
  const seed = seedPath ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : null;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor, colorScheme: 'dark', locale: 'cs-CZ' });
  if (seed?.now) await page.clock.setFixedTime(new Date(seed.now));
  await page.goto(`${base}/?mobile=1`);
  await page.getByText('Toto je jen ukázka.').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Profil' }).last().click();
  if (!(await page.getByText('Jana Ukázková').count())) throw new Error('Not the demo dataset — refusing to continue.');
  await page.getByRole('button', { name: 'Kalendář' }).last().click();
  if (seed?.lessons) {
    const lessons = lessonsFromSeed(seed);
    await page.waitForTimeout(1500); // let the demo's own sync land, then overwrite it
    await page.evaluate((data) => window.__reisStore.setState({ schedule: { data, status: 'success' } }), lessons);
    const n = await page.evaluate(() => window.__reisStore.getState().schedule.data.length);
    if (n !== lessons.length) throw new Error(`seed did not stick: ${n} lessons in store`);
  }
  await installCleanup(page);
  return page;
}

// Removes demo chrome and the partners block now AND whenever they re-render (e.g. on opening Profil).
async function installCleanup(page) {
  await page.evaluate(() => {
    const exact = (text) => {
      const hits = [...document.querySelectorAll('body *')].filter((el) => el.textContent?.trim() === text);
      return hits.filter((el) => !hits.some((o) => o !== el && o.contains(el)));
    };
    const partnersBlock = () => {
      const head = [...document.querySelectorAll('body *')].find(
        (el) => el.children.length === 0 && /^spolupracujeme s firmami$/i.test(el.textContent.trim()));
      if (!head) return null;
      // Climb to the block that holds the heading and the logos, but not the rest of Profil.
      let el = head;
      while (el.parentElement && !/Odhlásit se/.test(el.parentElement.textContent)) el = el.parentElement;
      return el;
    };
    const clean = () => {
      [...exact('Toto je jen ukázka.'), ...exact('UkázkaPřihlásit se')].forEach((el) => el.remove());
      partnersBlock()?.remove();
    };
    clean();
    new MutationObserver(clean).observe(document.body, { childList: true, subtree: true });
    window.__assertClean = () => {
      const t = document.body.innerText;
      const bad = ['Toto je jen ukázka.', 'Spolupracujeme s firmami', 'SPOLUPRACUJEME S FIRMAMI'].filter((s) => t.includes(s));
      return bad;
    };
  });
}

async function assertClean(page) {
  const bad = await page.evaluate(() => window.__assertClean());
  if (bad.length) throw new Error(`frame shows what a post must not: ${bad.join(', ')}`);
}

module.exports = { openDemo, assertClean };
