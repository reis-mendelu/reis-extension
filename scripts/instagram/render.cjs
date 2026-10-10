// Render one Instagram feed post (1080×1350 JPEG) from post.html + a JSON spec.
// Usage: node render.cjs <spec.json> <out.jpg>
// Fails (exit 1) instead of writing a bad image: brand fonts not loaded, text clipped, or content off-canvas.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const [specPath, out] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  if (spec.screenshot && !spec.screenshot.startsWith('data:')) {
    const abs = path.resolve(path.dirname(specPath), spec.screenshot);
    spec.screenshot = 'data:image/png;base64,' + fs.readFileSync(abs).toString('base64');
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 1,
  });
  await page.goto('file://' + path.join(__dirname, 'post.html'));
  await page.evaluate((s) => window.fill(s), spec);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));

  const check = () =>
    page.evaluate(() => {
      const p = [];
      // Every text element must be drawn in its own brand font — checked against its own text, because
      // Google serves Czech diacritics as a separate subset that loads only when used.
      for (const el of document.querySelectorAll('h1, .sub, .kicker, .foot')) {
        const t = el.textContent.trim();
        if (!t) continue;
        const cs = getComputedStyle(el);
        const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        if (!document.fonts.check(font, t))
          p.push(`font not loaded for .${el.className || el.tagName}: ${font}`);
      }
      for (const el of document.querySelectorAll('[data-max-lines]')) {
        if (!el.textContent.trim()) continue;
        const lines = Math.round(
          el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
        );
        if (lines > +el.dataset.maxLines)
          p.push(`#${el.id} has ${lines} lines (max ${el.dataset.maxLines})`);
      }
      for (const el of document.querySelectorAll('h1, .sub, .kicker, .foot')) {
        if (!el.textContent.trim()) continue;
        const r = el.getBoundingClientRect();
        if (r.left < 64 || r.right > 1080 - 64 || r.top < 40 || r.bottom > 1350 - 40)
          p.push(`${el.tagName.toLowerCase()} outside safe area`);
      }
      const h = document.querySelector('.head').getBoundingClientRect();
      const ph = document.querySelector('.phone')?.getBoundingClientRect();
      if (ph && h.bottom > ph.top - 24)
        p.push(
          `text block (bottom ${Math.round(h.bottom)}) runs into phone (top ${Math.round(ph.top)})`
        );
      return p;
    });
  // Auto-fit: step the headline down until everything passes; give up below 60px rather than ship tiny text.
  let problems = [];
  for (const size of spec.h1Size ? [spec.h1Size] : [88, 80, 72, 66, 60]) {
    await page.evaluate(
      (px) => document.documentElement.style.setProperty('--h1', px + 'px'),
      size
    );
    await page.evaluate(() => document.fonts.ready);
    // Phone sits 56 px under the text (never above 560), so short copy leaves no empty band.
    if (!spec.phoneTop)
      await page.evaluate(() => {
        const ph = document.querySelector('.phone');
        if (ph)
          ph.style.top =
            Math.max(
              560,
              Math.round(document.querySelector('.head').getBoundingClientRect().bottom + 56)
            ) + 'px';
      });
    problems = await check();
    if (!problems.length) {
      console.log('headline size', size);
      break;
    }
  }
  if (problems.length) {
    console.error('NOT RENDERED:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
  console.log('rendered', out);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
