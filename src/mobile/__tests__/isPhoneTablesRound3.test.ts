import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { $, $$, IS_PAGE, SIMPLE, page, run, setUrl, size } from './isPhoneTablesFixtures';

/**
 * Round three of the phone loop (2026-11-28): what a first-year persona still
 * tripped over on 125 saved IS pages after the automatic checks passed. Each
 * rule is read from the table itself, never from the page it is on.
 */
describe('the phone script, round three', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    setUrl(IS_PAGE);
    Object.defineProperty(window.screen, 'width', { value: 390, configurable: true });
    Object.defineProperty(window.screen, 'height', { value: 844, configurable: true });
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  // Exam terms' filter: "vypsal" ended one line and its dropdown began the next.
  it('keeps a filter label with its control in a one-row form', () => {
    document.body.innerHTML = page(
      '<table id="t"><tr><td>Předmět</td><td><select><option>x</option></select></td>' +
        '<td>vypsal</td><td><select><option>y</option></select></td><td><input type="submit"></td></tr></table>'
    );
    size('#t', 1300);
    run();
    const cells = $$('#t td');
    expect(cells.map((c) => c.classList.contains('reis-lab'))).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  /** A table that fits only by squeezing: its natural width shows while it is measured. */
  function squeezed(natural: number) {
    const t = $('#t');
    Object.defineProperty(t, 'scrollWidth', {
      get: () => (t.classList.contains('reis-measure') ? natural : 380),
      configurable: true,
    });
    Object.defineProperty(t, 'clientWidth', { get: () => 380, configurable: true });
  }

  // Moje oblíbené předměty: it "fit" by wrapping every cell to a word or two.
  it('turns a table that only fits by squeezing into cards, and measures without leaving a trace', () => {
    document.body.innerHTML = page(SIMPLE);
    squeezed(700);
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    expect($('#t').classList.contains('reis-measure')).toBe(false);
  });

  it('treats a header with a single squeezed row the same as many rows', () => {
    document.body.innerHTML = page(
      '<table id="t"><tr><th>Kód</th><th>Předmět</th><th>Garant</th><th>Pracoviště</th></tr>' +
        '<tr><td>XYZ</td><td>Dlouhý název</td><td>Ing. Vzor</td><td>Ústav</td></tr></table>'
    );
    squeezed(700);
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
  });

  it('leaves a table that fits comfortably, and one with no header to label cards', () => {
    document.body.innerHTML = page(SIMPLE);
    squeezed(450);
    const before = document.body.innerHTML;
    run();
    expect(document.body.innerHTML).toBe(before);

    document.head.innerHTML = '';
    document.body.innerHTML = page(
      '<table id="t"><tr><td>Jméno</td><td>dlouhý popis</td></tr><tr><td>Obor</td><td>dlouhý popis</td></tr></table>'
    );
    squeezed(2000);
    const plain = document.body.innerHTML;
    run();
    expect(document.body.innerHTML).toBe(plain);
  });

  // An empty list: a wide header and one "no data" row spanning it.
  it('shows a table with no data as its message alone', () => {
    document.body.innerHTML = page(
      '<table id="t"><tr><th>Kód</th><th>Název</th><th>Kdy</th><th>Kde</th></tr>' +
        '<tr><td colspan="4">Nenalezena žádná vyhovující data.</td></tr></table>'
    );
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    expect($$('#t tr').map((r) => r.className)).toEqual(['reis-head', 'reis-plain']);
  });

  /** Puts an element's box at x..x+width on one line. */
  function at(el: Element, left: number, width: number) {
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ width, height: 10, left, right: left + width, top: 0, bottom: 10 }),
    });
  }

  // The folder tree's expand/collapse boxes are about 10 px: too small to hit.
  it('gives a tiny icon-only link a bigger tap area, and leaves labelled links alone', () => {
    document.body.innerHTML = page(
      '<a id="t" href="#"><img alt=""></a> <a id="l" href="#"><img alt="">Složka</a>'
    );
    at($('#t').querySelector('img')!, 0, 10);
    at($('#t'), 0, 10);
    at($('#l').querySelector('img')!, 200, 10);
    at($('#l'), 200, 60);
    run();
    expect($('#t').classList.contains('reis-tap')).toBe(true);
    expect($('#l').className).toBe('');
  });

  // A bigger tap area must not reach over the link beside it: the toggle sits right before
  // the folder's name, and tapping the name's first letters must still open the folder.
  it.each([
    [30, 'reis-tap'],
    [20, 'reis-tap-8'],
    [10, 'reis-tap-4'],
    [6, ''],
  ])('keeps the tap area within half the gap to a neighbour %d px away (%s)', (gap, cls) => {
    document.body.innerHTML = page(
      '<a id="t" href="#"><img alt=""></a><a id="n" href="#">Ekologie</a>'
    );
    at($('#t').querySelector('img')!, 0, 10);
    at($('#t'), 0, 10);
    at($('#n'), 10 + gap, 60);
    run();
    const tap = [...$('#t').classList].filter((k) => k.startsWith('reis-tap'));
    expect(tap).toEqual(cls ? [cls] : []);
  });
});
