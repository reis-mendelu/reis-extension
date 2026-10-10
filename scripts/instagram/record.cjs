// Record a sharp phone clip of the reIS DEMO build for a Reel.
// Usage: node scripts/instagram/record.cjs <baseUrl> <script> <outDir> [seed.json]
// Writes outDir/clip.mp4 (780×1688, 30 fps).
//
// Why slow motion: CDP screencast frames come at 1× (390 px wide, too soft for a 1080 px Reel).
// Instead every CSS animation runs SLOW× slower while we take full-resolution screenshots in a
// loop, and each frame's duration is divided back by SLOW.
const { chromium } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { openDemo, assertClean } = require('./lib/demoPage.cjs');

const SLOW = 5;
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SLOW));

const scripts = {
  // Day view → Profil → Nastavení → Týden → back to the calendar, now a week.
  week: async (page, tap) => {
    await wait(1200);
    await tap(page.getByRole('button', { name: 'Profil' }).last());
    await tap(page.getByText('Nastavení', { exact: true }));
    await tap(page.getByRole('button', { name: 'Týden', exact: true }));
    await tap(page.getByRole('button', { name: 'Zavřít' }));
    await tap(page.getByRole('button', { name: 'Kalendář' }).last());
    await wait(1400);
  },
};

(async () => {
  const [base, scriptName, outArg, seedPath] = process.argv.slice(2);
  const outDir = path.resolve(outArg); // ffmpeg's concat list resolves paths from its own folder
  const run = scripts[scriptName];
  if (!run) throw new Error(`unknown script ${scriptName}; have ${Object.keys(scripts)}`);
  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await openDemo(browser, base, { seedPath, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = `.reis-tap{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
      background:rgba(121,190,21,.35);border:2px solid #79be15;pointer-events:none;z-index:2147483647;
      animation:reisTap .6s ease-out forwards}@keyframes reisTap{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(st);
    window.__ring = (x, y) => {
      const d = document.createElement('div');
      d.className = 'reis-tap';
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 700 * 5);
    };
  });
  await page.waitForTimeout(400);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  const frames = [];
  let recording = true;
  let dirty = null;
  const loop = (async () => {
    while (recording) {
      const t = Date.now() / 1000 / SLOW;
      const buf = await page.screenshot({ type: 'png' }).catch(() => null);
      if (buf) frames.push({ buf, t });
      if (frames.length % 20 === 0)
        await assertClean(page).catch((e) => {
          dirty = e;
        });
    }
  })();
  const tap = async (locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('tap target not visible');
    await page.evaluate(
      ([x, y]) => window.__ring(x, y),
      [box.x + box.width / 2, box.y + box.height / 2]
    );
    await wait(250);
    await locator.click({ timeout: 30000 * SLOW });
    await wait(900);
  };
  try {
    await run(page, tap);
  } finally {
    recording = false;
    await loop;
  }
  await browser.close();
  if (dirty) throw dirty;
  if (frames.length < 100) throw new Error(`only ${frames.length} frames captured`);

  const lines = [];
  frames.forEach((f, i) => {
    const file = path.join(framesDir, String(i).padStart(5, '0') + '.png');
    fs.writeFileSync(file, f.buf);
    const next = frames[i + 1]?.t ?? f.t + 0.5;
    lines.push(`file '${file}'`, `duration ${(next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${path.join(framesDir, String(frames.length - 1).padStart(5, '0') + '.png')}'`);
  fs.writeFileSync(path.join(outDir, 'frames.txt'), lines.join('\n'));
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    path.join(outDir, 'frames.txt'),
    '-vf',
    'fps=30,format=yuv420p',
    '-c:v',
    'libx264',
    '-crf',
    '16',
    path.join(outDir, 'clip.mp4'),
  ]);
  console.log(
    `recorded ${frames.length} frames, ${(frames.at(-1).t - frames[0].t).toFixed(1)} s → ${path.join(outDir, 'clip.mp4')}`
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
