/**
 * Kontrola plánu as VŠE's InSIS prints it: the same UIS as IS Mendelu, laid
 * out by groups for the whole plan. Two differences matter to the parser, and
 * both are consulted only where MENDELU's markup has nothing, so a MENDELU page
 * takes exactly the old path. See `__tests__/studyPlanInsisGroups.test.ts`.
 *
 * 1. A group row reads
 *      `<b>oSZ - Předměty státní závěrečné zkoušky (t: 1)</b><br />
 *       <b>Skupina předmětů povinných - <font><b>NESPLNĚNA …</b></font></b>`
 *    so the "Skupina předmětů…" heading is the row's SECOND top-level `<b>`,
 *    where MENDELU prints it as the first and only one.
 * 2. Each subject is printed twice: a `predmety_vse_<group>` row (all subjects
 *    of the group) and, when studied or compulsory, a `predmety_<group>` row
 *    (studied only). InSIS's script hides `.predmety_vse` on load, and the page
 *    has "Zobrazit všechny předměty skupiny" toggles for it. MENDELU's page has
 *    no toggle and prints only `predmety_vse` rows, which are its whole plan.
 */

const SUBJECT_ROW_CLASSES = ['predmety_vse', 'predmety', 'uis-hl-table'];

const text = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();

export interface LabelledGroupHeading {
  /** "Skupina předmětů povinných - NESPLNĚNA chybí 2 předměty" */
  heading: string;
  /** "oSZ - Předměty státní závěrečné zkoušky (t: 1)" */
  label: string;
}

/**
 * A group heading that is not the row's first `<b>` (InSIS), with the label
 * printed before it. Null on subject rows and on any row whose top-level `<b>`
 * after the first does not start with the group prefix.
 */
export function labelledGroupHeading(
  row: Element,
  groupPrefix: string
): LabelledGroupHeading | null {
  if (SUBJECT_ROW_CLASSES.some((c) => row.classList.contains(c))) return null;
  const topLevel = Array.from(row.querySelectorAll('b')).filter(
    (b) => !b.parentElement?.closest('b')
  );
  const [first, ...rest] = topLevel;
  const heading = rest.find((b) => text(b).startsWith(groupPrefix));
  if (!first || !heading) return null;
  return { heading: text(heading), label: text(first) };
}

/** True when the page offers InSIS's studied-only view next to the all-subjects one. */
export function hasStudiedOnlyView(doc: Document): boolean {
  return doc.querySelector('[id^="zobraz_vse_"], .zobraz_zapsane') !== null;
}
