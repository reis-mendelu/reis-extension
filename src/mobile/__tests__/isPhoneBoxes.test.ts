import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { $, IS_PAGE, nodes, page, run, sameNodes, setUrl, size } from './isPhoneTablesFixtures';

/**
 * Boxes that are not tables: IS's flex rows (the "Zobrazit:" column toggles)
 * and grids (filters, app logos) that cannot shrink, and pictures drawn at a
 * fixed width (charts). Judged by what they measure, never by which page they
 * are on: one that is wider than its room wraps or scrolls in its own box,
 * one that fits is left alone.
 *
 * happy-dom has no layout, so widths are set by hand.
 */
describe('the phone script and boxes wider than the phone', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    setUrl(IS_PAGE);
    Object.defineProperty(window.screen, 'width', { value: 390, configurable: true });
    Object.defineProperty(window.screen, 'height', { value: 844, configurable: true });
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  it.each([
    ['flex', 'reis-wrap'],
    ['grid', 'reis-stack'],
    ['inline-flex', 'reis-wrap'],
  ])('lets a %s box that is too wide wrap (%s)', (display, cls) => {
    document.body.innerHTML = page(
      `<div id="t" style="display: ${display}"><span>Období</span><span>Kód</span></div>`
    );
    size('#t', 900);
    run();
    expect($('#t').classList.contains(cls)).toBe(true);
  });

  it('leaves a box that fits, and a plain block, alone', () => {
    document.body.innerHTML = page(
      `<div id="t" style="display: flex"><span>a</span></div><div id="b"><span>b</span></div>`
    );
    size('#t', 380);
    size('#b', 900);
    const before = document.body.innerHTML;
    run();
    expect(document.body.innerHTML).toBe(before);
  });

  it('leaves boxes inside tables to the table treatments', () => {
    document.body.innerHTML = page(
      `<table><tr><td><div id="t" style="display: flex"><span>a</span></div></td></tr></table>`
    );
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-wrap')).toBe(false);
  });

  it('lets a picture wider than its box scroll inside that box', () => {
    document.body.innerHTML = page(`<div id="g"><svg id="t" style="width: 1000px"></svg></div>`);
    Object.defineProperty($('#t'), 'getBoundingClientRect', {
      value: () => ({ width: 1000, height: 400, left: 0, right: 1000, top: 0, bottom: 400 }),
    });
    pageEdges();
    run();
    expect($('#g').classList.contains('reis-scroll')).toBe(true);
  });

  /** The content column of a 412 px phone: 15 px in from each side. */
  function pageEdges() {
    Object.defineProperty($('.mainpage'), 'getBoundingClientRect', {
      value: () => ({ width: 382, height: 900, left: 15, right: 397, top: 0, bottom: 900 }),
    });
  }
  function drawnAt(left: number, width: number) {
    Object.defineProperty($('#t'), 'getBoundingClientRect', {
      value: () => ({ width, height: 70, left, right: left + width, top: 0, bottom: 70 }),
    });
  }

  it('also scrolls a picture narrower than the page that starts too far right', () => {
    document.body.innerHTML = page(`<div id="g"><svg id="t" style="width: 300px"></svg></div>`);
    drawnAt(200, 300);
    pageEdges();
    run();
    expect($('#g').classList.contains('reis-scroll')).toBe(true);
  });

  // IS's home tiles: a 70 px icon in a 64 px column. Making that column scroll cut the icon off.
  it('leaves a picture that only overflows its own box, not the page', () => {
    document.body.innerHTML = page(`<div id="g"><svg id="t" style="width: 70px"></svg></div>`);
    drawnAt(23, 70);
    Object.defineProperty($('#g'), 'clientWidth', { get: () => 64, configurable: true });
    pageEdges();
    run();
    expect($('#g').classList.contains('reis-scroll')).toBe(false);
  });

  // Mapa mých studií's "Dnes": a label in a box IS sizes to zero width, meant to overflow.
  it('marks a box IS sizes to zero width, and not one with only a zero minimum', () => {
    document.body.innerHTML = page(
      `<div id="t" style="width: 0px; padding: 0"><div>Dnes</div></div><div id="m" style="min-width: 0px">x</div>`
    );
    run();
    expect($('#t').classList.contains('reis-zero')).toBe(true);
    expect($('#m').classList.contains('reis-zero')).toBe(false);
  });

  it('gives text a line height no smaller than the text, and leaves normal text alone', () => {
    document.body.innerHTML = page(
      `<table><tr><td id="t" style="line-height: 10px; font-size: 13px">Ekologie a ochrana</td>` +
        `<td id="n" style="line-height: 20px; font-size: 13px">Finance</td>` +
        `<td id="i" style="line-height: 10px; font-size: 13px"><img alt=""></td></tr></table>`
    );
    run();
    expect($('#t').classList.contains('reis-lh')).toBe(true);
    expect($('#n').classList.contains('reis-lh')).toBe(false);
    expect($('#i').classList.contains('reis-lh')).toBe(false);
  });

  it('adds classes only: nothing is created, moved or removed', () => {
    document.body.innerHTML = page(
      `<form action="/x"><div id="t" style="display: flex"><input name="q" value="abc"><span>x</span></div></form>`
    );
    size('#t', 900);
    const before = nodes();
    run();
    expect(sameNodes(before)).toBe(true);
    expect(($('input[name="q"]') as HTMLInputElement).value).toBe('abc');
  });
});
