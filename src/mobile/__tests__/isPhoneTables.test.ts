import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildPhoneFrameScript } from '../isPhoneFrame';

/**
 * What the injected script does to IS's tables on a phone: it adds classes and
 * `data-label` attributes so the stylesheet can lay a too-wide table out as
 * cards. It never creates, moves or removes an element, because these tables
 * hold IS's own forms and links (exam registration is one of them).
 *
 * happy-dom has no layout, so "too wide" is set by hand on each table.
 */
const IS_PAGE = 'https://is.mendelu.cz/auth/student/terminy_seznam.pl';
const page = (main: string) => `
  <div class="wholepage"><div id="header"></div>
    <div id="base"><div id="base-right"><div id="stranka">
      <div class="mainpage">${main}</div>
    </div></div></div>
  </div>`;

const setUrl = (url: string) =>
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);
const run = () => new Function(buildPhoneFrameScript())();
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];

/** Gives a table a width it needs and a width it has. */
function size(sel: string, needs: number, has = 380) {
  const t = $(sel);
  Object.defineProperty(t, 'scrollWidth', { get: () => needs, configurable: true });
  Object.defineProperty(t, 'clientWidth', { get: () => has, configurable: true });
}
const tags = () => $$('body *').map((el) => el.tagName);

const SIMPLE = `<table id="t"><thead><tr><th></th><th>Název</th><th>Komentář</th><th>Vložil</th><th>Zobrazit</th><th>Body</th></tr></thead>
  <tbody><tr><td><img alt=""></td><td>Studijní opora Management</td><td></td><td><a href="#">J. Vzorová</a></td><td><a href="#"><img alt=""></a></td><td>-</td></tr>
  <tr><td colspan="6">Nenalezena žádná vyhovující data.</td></tr></tbody></table>`;

const exam = (
  h: string[]
) => `<table id="t"><thead><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
  <tbody><tr>${h.map((_, i) => `<td>v${i}</td>`).join('')}</tr></tbody></table>`;
const EXAM_CZ = [
  'Poř.',
  'Stav',
  'Kód',
  'Předmět',
  'Období',
  'Datum termínu',
  'Kde',
  'Druh (forma)',
  'Vypsal',
  'Přihlášeno',
  'Typ termínu',
  'Přihlašování od Přihlašování do Odhlašování do',
  'Operace',
  'Přihlásit',
];
const EXAM_EN = [
  'Ord.',
  'Status',
  'Code',
  'Course',
  'Study period',
  'Date of exam sitting',
  'Where',
  'Type (form)',
  'Put up by',
  'Registered',
  'Type of exam sitting',
  'Registration from Register until Unregister until',
  'Actions',
  'Register',
];
const EXAM_KEYS = [
  'por',
  'stav',
  'kod',
  'predmet',
  'obdobi',
  'datum',
  'kde',
  'druh',
  'vypsal',
  'prihl',
  'typ',
  'okno',
  'oper',
  'akce',
];

/** List záznamníku: two header rows, and a second time slot as a short row. */
const weeks = (n: number) => Array.from({ length: n }, (_, i) => `<td>${i + 1}.</td>`).join('');
const marks = (n: number) => Array.from({ length: n }, () => '<td></td>').join('');
const ATTENDANCE = `<table id="t"><tbody>
  <tr><td></td><td rowspan="2">Předmět</td><td colspan="7">Rozvrhová akce</td><td rowspan="2" colspan="2">Operace</td><td rowspan="2">Nastavení</td></tr>
  <tr><td></td><td>Kdy</td>${weeks(6)}</tr>
  <tr><td></td><td rowspan="2"><a href="#">XYZ Vzorový předmět</a></td><td>Př Po 9.00</td>${marks(6)}<td>-</td><td><a href="#"><img alt=""></a></td><td><a href="#"><img alt=""></a></td></tr>
  <tr><td></td><td>Cv Út 13.00</td>${marks(6)}</tr>
</tbody></table>`;

describe('the phone script and IS tables', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    setUrl(IS_PAGE);
    Object.defineProperty(window.screen, 'width', { value: 390, configurable: true });
    Object.defineProperty(window.screen, 'height', { value: 844, configurable: true });
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  it('leaves a table that fits exactly as it is', () => {
    document.body.innerHTML = page(SIMPLE);
    size('#t', 380);
    const before = document.body.innerHTML;
    run();
    expect(document.body.innerHTML).toBe(before);
  });

  it('turns a too-wide table with a plain header into cards, labelled from that header', () => {
    document.body.innerHTML = page(SIMPLE);
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    expect($('#t thead tr').classList.contains('reis-head')).toBe(true);
    const [row, note] = $$('#t tbody tr');
    expect(row!.classList.contains('reis-card')).toBe(true);
    const cells = [...row!.children] as HTMLElement[];
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual([
      '',
      'Název',
      'Komentář',
      'Vložil',
      'Zobrazit',
      'Body',
    ]);
    expect(cells[1]!.classList.contains('reis-title')).toBe(true);
    expect(cells[0]!.classList.contains('reis-icon')).toBe(true);
    expect(cells[2]!.classList.contains('reis-empty')).toBe(true);
    expect(cells[4]!.classList.contains('reis-icon')).toBe(true);
    expect(cells[5]!.classList.contains('reis-dash')).toBe(true);
    // A row that does not line up with the header ("no data") stays readable.
    expect(note!.classList.contains('reis-plain')).toBe(true);
    expect(note!.classList.contains('reis-head')).toBe(false);
  });

  it.each([
    ['Czech', EXAM_CZ],
    ['English', EXAM_EN],
  ])('lays an exam table out as exam rows, finding columns by their %s headers', (_, headers) => {
    document.body.innerHTML = page(exam(headers));
    size('#t', 1000);
    run();
    expect($('#t').classList.contains('reis-exam')).toBe(true);
    expect($('#t').classList.contains('reis-cards')).toBe(false);
    const cells = [...$('#t tbody tr').children] as HTMLElement[];
    expect(cells.map((c) => [...c.classList].find((k) => k.startsWith('x-')))).toEqual(
      EXAM_KEYS.map((k) => `x-${k}`)
    );
    expect(cells[9]!.getAttribute('data-label')).toBe(headers[9]);
  });

  it('reads the two header rows of List záznamníku and keeps a second time slot', () => {
    document.body.innerHTML = page(ATTENDANCE);
    size('#t', 1300);
    run();
    expect($('#t').classList.contains('reis-att')).toBe(true);
    const rows = $$('#t tr');
    expect(rows.map((r) => [...r.classList].join(' '))).toEqual([
      'reis-head',
      'reis-head',
      'a-main',
      'a-cont',
    ]);
    const main = [...rows[2]!.children] as HTMLElement[];
    expect(main[0]!.classList.contains('a-pad')).toBe(true);
    expect(main[1]!.classList.contains('a-title')).toBe(true);
    expect(main[2]!.classList.contains('a-slot')).toBe(true);
    expect(main.slice(3, 9).map((c) => c.getAttribute('data-label'))).toEqual([
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '6.',
    ]);
    expect(main.slice(3, 9).every((c) => c.classList.contains('a-week'))).toBe(true);
    expect(main[9]!.className).toContain('a-op1');
    expect(main[9]!.classList.contains('reis-dash')).toBe(true);
    expect(main[10]!.className).toContain('a-op2');
    expect(main[11]!.classList.contains('a-set')).toBe(true);
    const second = [...rows[3]!.children] as HTMLElement[];
    expect(second[1]!.classList.contains('a-slot')).toBe(true);
    expect(second.slice(2).every((c) => c.classList.contains('a-week'))).toBe(true);
  });

  it('only tightens a table it cannot read, and shrinks it when that is enough', () => {
    const irregular = `<table id="t"><tr><td>Kód</td><td>Název</td></tr><tr><td colspan="2">1. semestr</td></tr><tr><td>a</td><td>b</td></tr></table>`;
    document.body.innerHTML = page(irregular);
    size('#t', 420);
    run();
    expect($('#t').className).toBe('reis-compact reis-fit');
    expect($('#t').style.zoom).toBe('0.9');

    document.head.innerHTML = '';
    document.body.innerHTML = page(irregular);
    size('#t', 900);
    run();
    expect($('#t').className).toBe('reis-compact');
    expect($('#t').style.zoom).toBe('');
  });

  it('lets a one-row layout table (a filter form) wrap', () => {
    document.body.innerHTML = page(
      '<table id="t"><tr><td>Předmět</td><td><select><option>x</option></select></td></tr></table>'
    );
    size('#t', 1300);
    run();
    expect($('#t').className).toBe('reis-flow');
  });

  it('never touches IS tab rows', () => {
    document.body.innerHTML = page(
      '<table id="t" class="portal_menu"><tr><td><a href="#">Moje studium</a></td><td><a href="#">E-index</a></td></tr></table>'
    );
    size('#t', 900);
    run();
    expect($('#t').className).toBe('portal_menu');
  });

  it('adds classes and labels only: no element is created, moved or removed', () => {
    for (const html of [SIMPLE, exam(EXAM_CZ), ATTENDANCE]) {
      document.head.innerHTML = '';
      document.body.innerHTML = page(
        `<form action="/x"><input name="q" value="abc">${html}</form>`
      );
      size('#t', 1200);
      const before = tags();
      const text = document.body.textContent;
      run();
      expect(tags()).toEqual(before);
      expect(document.body.textContent).toBe(text);
      expect(($('input[name="q"]') as HTMLInputElement).value).toBe('abc');
    }
  });

  it('does nothing to tables on a page whose frame it does not know', () => {
    document.body.innerHTML = `<div class="mainpage">${SIMPLE}</div>`;
    size('#t', 900);
    run();
    expect($('#t').className).toBe('');
  });

  it('judges again when the phone is turned, and undoes what no longer applies', () => {
    document.body.innerHTML = page(SIMPLE);
    size('#t', 900);
    const root = document.documentElement;
    Object.defineProperty(root, 'clientWidth', { get: () => 390, configurable: true });
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);

    size('#t', 700, 844);
    window.dispatchEvent(new Event('resize'));
    expect($('#t').classList.contains('reis-cards')).toBe(true); // same width: a keyboard, not a turn

    Object.defineProperty(root, 'clientWidth', { get: () => 844, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect($('#t').classList.contains('reis-cards')).toBe(false);
  });
});
