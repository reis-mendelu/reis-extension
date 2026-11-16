import { hasStudiedOnlyView } from './studyPlanGroupLayout';
import { isLoginForm, type PageShape } from './isPage';
import type { StudyPlan } from '../types/studyPlan';

/**
 * What studijni_povinnosti.pl offered `parseStudyPlanDOM`, as counts: read
 * beside the parser, never instead of it.
 *
 * A row counts as an offered subject exactly when the parser would try to read
 * one from it: a `uis-hl-table` or `predmety_vse` row in `#tmtab_1` (or the
 * whole page without it), `predmety_vse` skipped in InSIS's studied-only view,
 * the "no recommended subjects" row skipped, and at least six visible cells.
 * The parser then drops every subject row that comes before a recognised
 * semester heading, so a heading IS rewords leaves offered rows and nothing
 * read: R1 in `./isPage.ts`.
 *
 * On real pages (2026-11-15, both languages) this counted 63 rows and the
 * parser read 63 subjects.
 *
 * Counts and booleans only: no text, href or id leaves this function.
 */
export interface StudyPlanPageShape extends PageShape {
  blocks: number;
  table: boolean;
  signedIn: boolean;
}

/** The parser's own row guard — keep in step with `parseStudyPlanDOM`, never ahead. */
const MIN_VISIBLE_CELLS = 6;

export function studyPlanPageShape(
  doc: Document,
  html: string,
  noSubjectsMessage: string,
  plan: StudyPlan
): StudyPlanPageShape {
  const table = doc.getElementById('tmtab_1');
  const studiedOnly = hasStudiedOnlyView(doc);
  const rows = Array.from((table ?? doc).querySelectorAll('tr')).filter((row) => {
    const vse = row.classList.contains('predmety_vse');
    if (studiedOnly && vse) return false;
    if (!vse && !row.classList.contains('uis-hl-table')) return false;
    if ((row.textContent || '').includes(noSubjectsMessage)) return false;
    const visible = Array.from(row.querySelectorAll('td')).filter(
      (cell) => !cell.classList.contains('UISTMNumberCellHidden')
    );
    return visible.length >= MIN_VISIBLE_CELLS;
  }).length;
  return {
    rows,
    blocks: plan.blocks.length,
    table: !!table,
    signedIn: html.includes('logout.pl'),
    loginForm: isLoginForm(html),
  };
}

/** Subjects the parser read, across every block and group. */
export function studyPlanSubjectCount(plan: StudyPlan): number {
  return plan.blocks.reduce(
    (n, block) => n + block.groups.reduce((m, group) => m + group.subjects.length, 0),
    0
  );
}
