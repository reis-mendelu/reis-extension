import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { $, $$, IS_PAGE, page, run, setUrl, size } from './isPhoneTablesFixtures';

/**
 * Label/value tables (the syllabus's details: "Kód předmětu:" beside its
 * value, one pair per row, no header). Too wide for a phone, each value goes
 * under its label instead of scrolling sideways with its values cut off.
 * Read from the table itself: two cells per row, the first a label ending
 * with a colon.
 */
const row = (label: string, value: string) =>
  `<tr><td width="100"><b><span class="nowrap">${label}</span></b></td><td>${value}</td></tr>`;
const DETAILS = `<table id="t"><tbody>${row('Kód předmětu:', 'XYZ-ABC')}${row(
  'Název předmětu:',
  'Vzorové webové aplikace'
)}${row('Forma výuky:', 'prezenční')}<tr><td colspan="2">Poznámka bez popisku</td></tr></tbody></table>`;

describe('the phone script and label/value tables', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    setUrl(IS_PAGE);
    Object.defineProperty(window.screen, 'width', { value: 390, configurable: true });
    Object.defineProperty(window.screen, 'height', { value: 844, configurable: true });
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  it('puts each value under its label when the table is too wide', () => {
    document.body.innerHTML = page(DETAILS);
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-kv')).toBe(true);
    const rows = $$('#t tr');
    expect(rows.slice(0, 3).every((r) => r.classList.contains('kv-pair'))).toBe(true);
    expect(rows[0]!.children[0]!.classList.contains('kv-label')).toBe(true);
    // A row that is not a pair stays readable as it is.
    expect(rows[3]!.classList.contains('reis-plain')).toBe(true);
  });

  // The syllabus keeps its topic list as a table inside the "Osnova:" value.
  it('still takes it for label/value pairs when one value holds a table', () => {
    document.body.innerHTML = page(
      DETAILS.replace(
        'prezenční',
        'prezenční<table><tr><td>1.</td><td>Úvod</td></tr><tr><td>2.</td><td>Závěr</td></tr></table>'
      )
    );
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-kv')).toBe(true);
  });

  it('leaves a label/value table that fits', () => {
    document.body.innerHTML = page(DETAILS);
    size('#t', 380);
    const before = document.body.innerHTML;
    run();
    expect(document.body.innerHTML).toBe(before);
  });

  it('needs most first cells to be labels, not just half', () => {
    document.body.innerHTML = page(
      `<table id="t"><tbody>${row('Kód:', 'X')}${row('Název:', 'Y')}${row('A', 'Z')}${row(
        'B',
        'W'
      )}</tbody></table>`
    );
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-kv')).toBe(false);
  });

  // The syllabus's topic list: "1.", "a." beside a topic. Not labels.
  it('does not take a numbered list for labels', () => {
    document.body.innerHTML = page(
      `<table id="t"><tbody>${row('1.', 'Webové aplikace')}${row('2.', 'Databáze')}${row(
        '3.',
        'Sítě'
      )}</tbody></table>`
    );
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-kv')).toBe(false);
  });
});
