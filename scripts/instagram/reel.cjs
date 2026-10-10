// Assemble a 1080×1920 Reel: intro card → phone with the recorded clip → outro card.
// Usage: node reel.cjs <spec.json> <clip.mp4> <out.mp4>
// Fails instead of writing a bad video: fonts not loaded, text over its line budget, clip missing.
const { chromium } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INTRO = 2.2, OUTRO = 2.8, FADE = 0.4;

(async () => {
  const [specPath, clip, out] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const tmp = path.join(path.dirname(out), 'reel-layers');
  fs.mkdirSync(tmp, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, 'reel.html'));
  for (const layer of ['intro', 'bg', 'frame', 'outro']) {
    await page.evaluate(([s, l]) => window.fill(s, l), [spec, layer]);
    await page.evaluate(() => document.fonts.ready);
    const problems = await page.evaluate(() => {
      const p = [];
      for (const el of document.querySelectorAll('h1, h2, .sub, .cap, .cta')) {
        if (!el.offsetParent || !el.textContent.trim()) continue;
        const cs = getComputedStyle(el);
        if (!document.fonts.check(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, el.textContent)) p.push(`font not loaded: ${el.id}`);
        const r = el.getBoundingClientRect();
        if (r.left < 60 || r.right > 1020) p.push(`${el.id} outside safe width`);
        if (el.dataset.maxLines) {
          const lines = Math.round(r.height / parseFloat(cs.lineHeight));
          if (lines > +el.dataset.maxLines) p.push(`${el.id} has ${lines} lines (max ${el.dataset.maxLines})`);
        }
      }
      return p;
    });
    if (problems.length) { console.error(`NOT RENDERED (${layer}):\n- ` + problems.join('\n- ')); process.exit(1); }
    await page.screenshot({ path: path.join(tmp, layer + '.png'), omitBackground: layer === 'frame' });
  }
  await browser.close();

  const clipDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]).toString());
  if (!(clipDur > 2)) throw new Error(`clip too short: ${clipDur}s`);
  const norm = 'fps=30,format=yuv420p,setsar=1';
  const filter = [
    `[0:v]${norm},trim=duration=${INTRO}[intro]`,
    `[2:v]scale=700:1515:flags=lanczos[scr]`,
    `[1:v][scr]overlay=190:340:shortest=1[s1]`,
    `[s1][3:v]overlay=0:0,${norm}[main]`,
    `[4:v]${norm},trim=duration=${OUTRO}[outro]`,
    `[intro][main]xfade=transition=fade:duration=${FADE}:offset=${INTRO - FADE}[a]`,
    `[a][outro]xfade=transition=fade:duration=${FADE}:offset=${INTRO + clipDur - 2 * FADE}[v]`,
  ].join(';');
  const L = (f) => ['-loop', '1', '-t', String(INTRO + clipDur + OUTRO), '-i', path.join(tmp, f)];
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...L('intro.png'), ...L('bg.png'), '-i', clip, ...L('frame.png'), ...L('outro.png'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex', filter, '-map', '[v]', '-map', '5:a', '-shortest',
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', out], { stdio: 'inherit' });
  const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height', '-of', 'compact', out]).toString();
  console.log(info.trim());
})().catch((e) => { console.error(e.message); process.exit(1); });
