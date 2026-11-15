import { AVAILABLE_TABLE, BLOCKED_TABLE } from '../utils/parsers/exams/availableTermsParser';
import { isLoginForm, type PageShape } from './isPage';

/**
 * What terminy_seznam.pl offered the exam parser, as counts: read beside
 * `parseExamData`, never instead of it.
 *
 * A row counts only when the parser itself would try to read it: the same
 * `tbody tr` selector per table and the same minimum cell count it checks
 * first (6 in `registeredTermsParser`, 8 in `availableTermsParser`). A
 * one-cell "no terms" placeholder is therefore never an offered row, which
 * matters because no real empty terminy_seznam page is on file to show how IS
 * draws one. On a real page (2026-11-15) every term row had 12 to 14 cells.
 *
 * Counts and booleans only: no text, href or id leaves this function.
 */
export interface ExamsPageShape extends PageShape {
  registered: number;
  available: number;
  blocked: number;
  /** How many of #table_1, #table_2 and #table_3 exist at all. */
  tables: number;
  signedIn: boolean;
}

/** The parsers' own first guards — keep in step with them, never ahead. */
const REGISTERED_MIN_CELLS = 6;
const AVAILABLE_MIN_CELLS = 8;

export function examsPageShape(html: string): ExamsPageShape {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const offered = (selector: string, minCells: number) =>
    Array.from(doc.querySelectorAll(`${selector} tbody tr`)).filter(
      (row) => row.querySelectorAll('td').length >= minCells
    ).length;
  const registered = offered('#table_1', REGISTERED_MIN_CELLS);
  const available = offered(AVAILABLE_TABLE.selector, AVAILABLE_MIN_CELLS);
  const blocked = offered(BLOCKED_TABLE.selector, AVAILABLE_MIN_CELLS);
  return {
    rows: registered + available + blocked,
    registered,
    available,
    blocked,
    tables: ['#table_1', AVAILABLE_TABLE.selector, BLOCKED_TABLE.selector].filter((s) =>
      doc.querySelector(s)
    ).length,
    signedIn: html.includes('logout.pl'),
    loginForm: isLoginForm(html),
  };
}
