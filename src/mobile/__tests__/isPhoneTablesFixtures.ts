import { buildPhoneFrameScript } from '../isPhoneFrame';

/**
 * Pages and tables for isPhoneTables.test.ts, made up in the shapes IS uses.
 * happy-dom has no layout, so "too wide" is set by hand on each table (`size`).
 */
export const IS_PAGE = 'https://is.mendelu.cz/auth/student/terminy_seznam.pl';
export const page = (main: string) => `
  <div class="wholepage"><div id="header"></div>
    <div id="base"><div id="base-right"><div id="stranka">
      <div class="mainpage">${main}</div>
    </div></div></div>
  </div>`;

export const setUrl = (url: string) =>
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);
export const run = () => new Function(buildPhoneFrameScript())();
export const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
export const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];

/** Gives a table a width it needs and a width it has. */
export function size(sel: string, needs: number, has = 380) {
  const t = $(sel);
  Object.defineProperty(t, 'scrollWidth', { get: () => needs, configurable: true });
  Object.defineProperty(t, 'clientWidth', { get: () => has, configurable: true });
}
export const tags = () => $$('body *').map((el) => el.tagName);

export const SIMPLE = `<table id="t"><thead><tr><th></th><th>Název</th><th>Komentář</th><th>Vložil</th><th>Zobrazit</th><th>Body</th></tr></thead>
  <tbody><tr><td><img alt=""></td><td>Studijní opora Management</td><td></td><td><a href="#">J. Vzorová</a></td><td><a href="#"><img alt=""></a></td><td>-</td></tr>
  <tr><td colspan="6">Nenalezena žádná vyhovující data.</td></tr></tbody></table>`;

export const exam = (
  h: string[]
) => `<table id="t"><thead><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
  <tbody><tr>${h.map((_, i) => `<td>v${i}</td>`).join('')}</tr></tbody></table>`;
export const EXAM_CZ = [
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
export const EXAM_EN = [
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
export const EXAM_KEYS = [
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

/** Moji spolužáci: a row number, a photo, a name, the study, an e-mail icon. */
export const PEOPLE = `<table id="t"><tbody>
  <tr><th></th><th>Fotografie</th><th>Jméno spolužáka</th><th>Informace o studiu</th><th>Poslat e-mail</th></tr>
  <tr><td>1.</td><td><a href="#"><img width="77" height="96" alt=""></a></td><td><a href="#">Vzorová Jana</a></td><td>PEF B-XX prez [sem 3, roč 2]</td><td><a href="#"><span class="uf-icon"><svg></svg></span></a></td></tr>
</tbody></table>`;

/** List záznamníku: two header rows, and a second time slot as a short row. */
export const weeks = (n: number) =>
  Array.from({ length: n }, (_, i) => `<td>${i + 1}.</td>`).join('');
export const marks = (n: number) => Array.from({ length: n }, () => '<td></td>').join('');
export const ATTENDANCE = `<table id="t"><tbody>
  <tr><td></td><td rowspan="2">Předmět</td><td colspan="7">Rozvrhová akce</td><td rowspan="2" colspan="2">Operace</td><td rowspan="2">Nastavení</td></tr>
  <tr><td></td><td>Kdy</td>${weeks(6)}</tr>
  <tr><td></td><td rowspan="2"><a href="#">XYZ Vzorový předmět</a></td><td>Př Po 9.00</td>${marks(6)}<td>-</td><td><a href="#"><img alt=""></a></td><td><a href="#"><img alt=""></a></td></tr>
  <tr><td></td><td>Cv Út 13.00</td>${marks(6)}</tr>
</tbody></table>`;
