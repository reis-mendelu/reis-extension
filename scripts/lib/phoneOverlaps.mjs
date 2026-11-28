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

/**
 * Finds text drawn smaller than 11 px: the font size times every `zoom` and transform on
 * the way up (a table tightened to 12 px and zoomed to 0.86 is 10 px on
 * screen; the syllabus details came out so on 2026-11-28). The week numbers
 * in List záznamníku's attendance boxes are exempt: Dominik approved them
 * small to fit twelve weeks in a row. Same keys and use as `findOverlaps`.
 */
export function findSmallText() {
  const root = document.querySelector('.mainpage') || document.body;
  const out = new Map();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.data.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!s || !el || el.closest('svg, script, style, select, option, td.a-week')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || el.getBoundingClientRect().width === 0) continue;
    let size = parseFloat(cs.fontSize);
    for (let p = el; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      size *= parseFloat(ps.zoom || '1') || 1;
      // A transform scales text too (exam rows scale their badge column to 0.8).
      if (ps.transform && ps.transform !== 'none') {
        const m = new DOMMatrixReadOnly(ps.transform);
        size *= Math.hypot(m.a, m.b);
      }
    }
    if (size < 10.95) out.set('text:' + s.slice(0, 40), Math.round(size * 10) / 10 + 'px');
  }
  return [...out].map(([key, size]) => ({ key, size }));
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
    marks.push({ kind: 'pic', el, key, box: b, icon });
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
        marks.push({ kind: 'text', el, node: n, key: 'text:' + s.slice(0, 40), box: b });
  }
  marks.sort((a, b) => a.box.top - b.box.top);
  const found = new Map();
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i];
    for (let j = i + 1; j < marks.length && marks[j].box.top < a.box.bottom - 2; j++) {
      const b = marks[j];
      if (a.kind === 'text' && b.kind === 'text') {
        // Lines of one text node follow each other; two different text nodes must not cross,
        // even when one sits inside the other's element (a link inside its table cell).
        if (a.node === b.node) continue;
      } else if (a.kind === b.kind) {
        // Nested pictures are one picture (an svg inside an image's wrapper).
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // One IS icon is several drawings layered in one box (a base and a decorator).
        if (a.kind === 'pic' && a.icon && a.icon === b.icon) continue;
      } else {
        // Text drawn inside a picture belongs to it; an icon over its OWN label is a fault.
        const pic = a.kind === 'pic' ? a : b;
        const text = pic === a ? b : a;
        if (pic.el.contains(text.el)) continue;
      }
      const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (w <= 2 || h <= 2) continue;
      const key = [a.key, b.key].sort().join(' | ');
      if (!found.has(key)) found.set(key, Math.round(w) + 'x' + Math.round(h));
    }
  }
  return [...found].map(([key, size]) => ({ key, size }));
}

/**
 * check:phone-frame's folder-tree toggle (#tree-toggle, a 10 px icon link): 'bigger' when its
 * tap area grew to 18 px or more without taking taps from the links around it.
 */
export function treeToggleTap() {
  // Every link or control near the toggle, tapped at its point nearest the toggle, must still
  // be what the tap reaches (an earlier one, drawn under the toggle, is the one at risk).
  document.getElementById('tree-toggle').scrollIntoView({ block: 'center' });
  const toggle = document.getElementById('tree-toggle');
  // Only the part a finger can reach: a scrolling box (IS's tables are) clips the padding.
  let r = toggle.getBoundingClientRect();
  for (let p = toggle.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflow === 'visible') continue;
    const c = p.getBoundingClientRect();
    const left = Math.max(r.left, c.left),
      right = Math.min(r.right, c.right);
    const top = Math.max(r.top, c.top),
      bottom = Math.min(r.bottom, c.bottom);
    r = {
      left,
      right,
      top,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }
  const icon = document.querySelector('#tree-toggle img').getBoundingClientRect();
  const stolen = [
    ...document.querySelectorAll(
      '.mainpage a, .mainpage button, .mainpage input, .mainpage select, .mainpage textarea'
    ),
  ]
    .filter((o) => o.id !== 'tree-toggle')
    .flatMap((o) => [...o.getClientRects()].map((b) => ({ o, b })))
    .filter(
      ({ b }) =>
        b.width > 2 &&
        Math.max(
          b.left - icon.right,
          icon.left - b.right,
          b.top - icon.bottom,
          icon.top - b.bottom
        ) < 40
    )
    .filter(({ o, b }) => {
      const x = Math.min(Math.max((icon.left + icon.right) / 2, b.left + 1), b.right - 1);
      const y = Math.min(Math.max((icon.top + icon.bottom) / 2, b.top + 1), b.bottom - 1);
      return document.elementFromPoint(x, y)?.closest('a, button, input, select, textarea') !== o;
    });
  const size =
    Math.min(r.width, r.height) >= 18 ? 'bigger' : `${Math.round(r.width)}x${Math.round(r.height)}`;
  return stolen.length
    ? `${size}, and a tap meant for a neighbouring ${stolen[0].o.tagName.toLowerCase()} reaches the toggle`
    : size;
}
