import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildPhoneFrameScript } from '../isPhoneFrame';
import { IS_PHONE_FRAME_CSS } from '../isPhoneFrameCss';

/**
 * The script the in-app browser runs at document start on every page. It is a
 * string evaluated inside an authenticated IS page, so what it may touch is the
 * whole contract: an IS page with the frame we know, on a phone, and nothing
 * else.
 */
const IS_PAGE = 'https://is.mendelu.cz/auth/student/terminy_seznam.pl';

/** The frame every signed-in IS page shares, as dumped from live IS (Nov 2026). */
const FRAME = `
  <div class="wholepage">
    <div id="header"><div class="left"><img id="uis-logo"></div><div class="right"></div></div>
    <nav><ol class="breadcrumb"></ol></nav>
    <div id="base"><div id="base-right"><div id="stranka">
      <div><div class="portletbar"></div></div>
      <div class="mainpage"><table><tr><td>x</td></tr></table></div>
    </div></div></div>
  </div>`;

const setUrl = (url: string) =>
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);

function setScreen(width: number, height: number) {
  Object.defineProperty(window.screen, 'width', { value: width, configurable: true });
  Object.defineProperty(window.screen, 'height', { value: height, configurable: true });
}

const run = () => new Function(buildPhoneFrameScript())();
const viewport = () => document.querySelector('meta[name="viewport"]');
const style = () => document.getElementById('reis-phone-frame');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('buildPhoneFrameScript', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    setUrl(IS_PAGE);
    setScreen(390, 844);
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  it('gives an IS page the phone width and the frame stylesheet', () => {
    document.body.innerHTML = FRAME;
    run();
    expect(viewport()?.getAttribute('content')).toBe('width=device-width, initial-scale=1');
    expect(style()?.textContent).toBe(IS_PHONE_FRAME_CSS);
  });

  // The safety net that replaces an "original view" switch: a page whose frame
  // we do not recognise must look exactly as it does today.
  it('leaves a page without the known frame exactly as it is', () => {
    document.body.innerHTML = '<div id="header"></div><table><tr><td>x</td></tr></table>';
    run();
    expect(viewport()).toBeNull();
    expect(style()).toBeNull();
  });

  it('leaves the page alone when IS sets a phone width itself', () => {
    document.head.innerHTML = '<meta name="viewport" content="width=device-width">';
    document.body.innerHTML = FRAME;
    run();
    expect(style()).toBeNull();
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1);
  });

  // 810 is the iPad the app is tested on; 744 is the iPad mini, the narrowest
  // tablet there is, and 600 is where Android itself starts calling a screen a
  // tablet (sw600dp).
  it.each([
    [810, 1080],
    [1080, 810],
    [744, 1133],
    [1133, 744],
    [600, 960],
  ])('does nothing on a tablet (%i x %i)', (width, height) => {
    document.body.innerHTML = FRAME;
    setScreen(width, height);
    run();
    expect(viewport()).toBeNull();
    expect(style()).toBeNull();
  });

  it('still styles the widest phone', () => {
    document.body.innerHTML = FRAME;
    setScreen(440, 956);
    run();
    expect(style()).not.toBeNull();
  });

  it('still styles a phone held sideways', () => {
    document.body.innerHTML = FRAME;
    setScreen(844, 390);
    run();
    expect(style()).not.toBeNull();
  });

  it('does nothing on any other site the in-app browser reaches', () => {
    setUrl('https://example.com/page');
    document.body.innerHTML = FRAME;
    run();
    expect(viewport()).toBeNull();
    expect(style()).toBeNull();
  });

  it('applies once the frame arrives, since it runs before the page exists', async () => {
    run();
    expect(style()).toBeNull();
    document.body.innerHTML = FRAME;
    await flush();
    expect(viewport()).not.toBeNull();
    expect(style()).not.toBeNull();
  });

  it('adds nothing twice', async () => {
    document.body.innerHTML = FRAME;
    run();
    run();
    document.body.appendChild(document.createElement('p'));
    await flush();
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1);
    expect(document.querySelectorAll('#reis-phone-frame')).toHaveLength(1);
  });

  it('only ever adds: no element of the page is removed or moved', () => {
    document.head.innerHTML =
      '<meta charset="UTF-8"><title>IS</title><link rel="icon" href="/favicon.ico"><style>body{margin:0}</style>';
    document.body.innerHTML = FRAME;
    const before = document.body.innerHTML;
    const headBefore = [...document.head.children];
    run();
    expect(document.body.innerHTML).toBe(before);
    // IS's own head nodes: the same objects, in the same order, ahead of ours.
    const headAfter = [...document.head.children];
    expect(headAfter.slice(0, headBefore.length)).toEqual(headBefore);
    headBefore.forEach((node, i) => expect(headAfter[i]).toBe(node));
    expect(headAfter.slice(headBefore.length).map((n) => n.tagName)).toEqual(['META', 'STYLE']);
  });

  it('carries the stylesheet as data, so no CSS can end the script early', () => {
    const script = buildPhoneFrameScript();
    expect(script).toContain(JSON.stringify(IS_PHONE_FRAME_CSS));
    expect(() => new Function(script)).not.toThrow();
  });
});

describe('IS_PHONE_FRAME_CSS', () => {
  /** Every `selector { declarations }` pair, at-rule wrappers flattened away. */
  const rules = [...IS_PHONE_FRAME_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.trim(),
    body: m[2]!,
  }));

  // Decided 2026-11-28: a table shown as cards may hide what the cards replace
  // (its header row, empty cells, three exam columns). Nothing else on an IS
  // page is ever hidden, so every such rule must be scoped to a table the
  // script has re-read, which all carry a `reis-` class.
  it('hides things only inside a table the script has re-read', () => {
    const hiding = rules.filter((r) => /display\s*:\s*none|visibility\s*:\s*hidden/.test(r.body));
    expect(hiding.length).toBeGreaterThan(0);
    for (const rule of hiding) {
      for (const part of rule.selector.split(','))
        expect(part).toMatch(/table(\.reis-|\[class\*="reis-"\])/);
    }
  });

  // The only text the stylesheet may add is a column's own header in front of
  // its value. Invented wording would be reIS speaking in IS's voice, in one
  // language, on a page that has two.
  it('generates no text of its own, only a column header before its value', () => {
    const allowed = ['attr(data-label)', "attr(data-label) ' '", 'none', 'none !important'];
    const used = rules.flatMap((r) =>
      [...r.body.matchAll(/content\s*:\s*([^;]+);/g)].map((m) => m[1]!.trim())
    );
    expect(used.length).toBeGreaterThan(0);
    for (const value of used) expect(allowed).toContain(value);
  });

  // A table that fits again after the phone is turned loses its table class,
  // but its rows and cells keep theirs. No rule may style those on their own.
  it('styles a tagged row or cell only inside a table that is being shown that way', () => {
    const tagged =
      /\.(reis-(card|plain|head|title|icon|empty|dash|person|photo|num)|a-(main|cont|title|slot|week|op\d?|set|pad)|kv-(pair|label)|x-[a-z]+)\b/;
    const parts = rules
      .flatMap((r) => r.selector.split(/,(?![^(]*\))/))
      .filter((part) => tagged.test(part));
    expect(parts.length).toBeGreaterThan(20);
    for (const part of parts) expect(part).toMatch(/table(\.reis-|\[class\*="reis-"\])/);
  });

  it('loads nothing from anywhere', () => {
    expect(IS_PHONE_FRAME_CSS).not.toMatch(/url\(|@import/);
  });
});
