/**
 * Finds things drawn on top of each other in an IS page's content: a line of
 * text under an icon, two icons in one place, two lines of text crossing.
 * Run inside the page (`page.evaluate(findOverlaps)`), so it is plain JS that
 * only uses the page's own DOM.
 *
 * Width checks miss this whole kind of fault: on 2026-11-28 an IS icon row
 * laid out for "icon above label" squeezed an "icon beside label" row into
 * narrow cells, the icon landed on the label, and every width check passed.
 *
 * Returned pairs are keyed by what they show (text, icon id, image size), not
 * by position, so a caller can subtract the overlaps IS already has without
 * the phone script and judge only what the script caused.
 *
 * Not counted: anything fixed on screen (IS's floating arrows), anything
 * hidden or empty, text inside the icon it overlaps, and touches of 2 px or
 * less.
 */
/**
 * Finds text squeezed into a sliver: a few letters per line, stacked down the
 * screen ("Q / 0 / 8 / ( / Č / P / )"). It neither overlaps anything nor
 * sticks out, so the other checks pass it; seen on exam rows at 320 px on
 * 2026-11-28, when a grid column was left no room. Same keys and use as
 * `findOverlaps`.
 */
export function findCrushedText() {
  const root = document.querySelector('.mainpage') || document.body;
  const out = new Set();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.data.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (s.replace(/ /g, '').length < 4 || !el || el.closest('svg, script, style, select, option'))
      continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const lines = [...r.getClientRects()].filter((b) => b.width > 0 && b.height > 0);
    if (lines.length < 3) continue;
    const em = parseFloat(getComputedStyle(el).fontSize) || 16;
    if (Math.max(...lines.map((b) => b.width)) < 2.5 * em) out.add('text:' + s.slice(0, 40));
  }
  return [...out].map((key) => ({ key, size: 'sliver' }));
}

export function findOverlaps() {
  const root = document.querySelector('.mainpage') || document.body;
  const fixed = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement)
      if (getComputedStyle(p).position === 'fixed') return true;
    return false;
  };
  const seen = (el) => {
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const marks = [];
  // Icons and pictures: the drawn box (an IS icon's svg is positioned inside its span).
  for (const el of root.querySelectorAll('img, svg')) {
    if (el.closest('svg') !== el && el.tagName.toLowerCase() === 'svg') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 4 || b.height < 4 || !seen(el) || fixed(el)) continue;
    const icon = el.closest('.uf-icon');
    const key = icon
      ? 'icon:' + (icon.getAttribute('data-sysid') || icon.getAttribute('data-id') || '?')
      : 'img:' + (el.getAttribute('width') || '') + 'x' + (el.getAttribute('height') || '');
    marks.push({ kind: 'pic', el, key, box: b });
  }
  // Text: each line box of each text node.
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.data.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!s || !el || el.closest('svg, script, style, select, option, noscript')) continue;
    if (!seen(el) || fixed(el)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const b of r.getClientRects())
      if (b.width > 2 && b.height > 2)
        marks.push({ kind: 'text', el, key: 'text:' + s.slice(0, 40), box: b });
  }
  marks.sort((a, b) => a.box.top - b.box.top);
  const found = new Map();
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i];
    for (let j = i + 1; j < marks.length && marks[j].box.top < a.box.bottom - 2; j++) {
      const b = marks[j];
      if (a.kind === 'text' && b.kind === 'text' && a.el === b.el) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (w <= 2 || h <= 2) continue;
      const key = [a.key, b.key].sort().join(' | ');
      if (!found.has(key)) found.set(key, Math.round(w) + 'x' + Math.round(h));
    }
  }
  return [...found].map(([key, size]) => ({ key, size }));
}
