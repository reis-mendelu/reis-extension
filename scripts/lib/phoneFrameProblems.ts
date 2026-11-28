/**
 * What check-phone-frame.ts measures on its fixture page, and what it calls a
 * problem. Split out to keep the check itself short.
 */

export interface TableFacts {
  id: string;
  /** What the fixture says this table must become: a class, or "scroll". */
  expect: string;
  classes: string;
  needsSidewaysScroll: boolean;
  scrollsByTouch: boolean;
  /** Cells whose right edge is past the page's, before any scrolling. */
  cellsPastEdge: number;
  lastColumnReachable: boolean;
}

export interface Facts {
  styled: boolean;
  layoutWidth: number;
  pageScrollWidth: number;
  /** Elements wider than the page that are not inside a box that scrolls. */
  stickingOut: string[];
  /** Form controls whose right edge is past the page's. */
  controlsPastEdge: string[];
  tables: TableFacts[];
  registerVisible: boolean;
  /** Computed sizes inside an exam row: the stylesheet's rules compete on weight, and have lost before. */
  examSizes: string;
  /** People rows: a small photo, and a row no taller than about two lines of text beside it. */
  peopleSizes: string;
}

export function problems(width: number, f: Facts): string[] {
  const out: string[] = [];
  if (!f.styled) out.push('the frame stylesheet was not applied');
  if (f.layoutWidth !== width) out.push(`laid out ${f.layoutWidth}px wide, not ${width}px`);
  if (f.pageScrollWidth > width) out.push(`the page scrolls sideways (${f.pageScrollWidth}px)`);
  if (f.stickingOut.length) out.push(`sticking out of the page: ${f.stickingOut.join(', ')}`);
  if (f.controlsPastEdge.length)
    out.push(`form controls past the edge: ${f.controlsPastEdge.join(', ')}`);
  const sizes = 'x-predmet 15px pad 0px, x-druh 12px pad 0px, x-datum 14px pad 0px';
  if (f.examSizes !== sizes) out.push(`exam row sizes are "${f.examSizes}", expected "${sizes}"`);
  const people = '2 rows, photo 44x55, short';
  if (f.peopleSizes !== people)
    out.push(`people rows are "${f.peopleSizes}", expected "${people}"`);
  if (!f.registerVisible)
    out.push('the exam register control is not on screen without scrolling sideways');
  for (const t of f.tables) {
    if (t.expect === 'scroll') {
      if (!t.scrollsByTouch) out.push(`#${t.id} should scroll inside its own box and does not`);
      if (!t.lastColumnReachable)
        out.push(`#${t.id}: the last column cannot be scrolled into view`);
      continue;
    }
    if (!t.classes.split(' ').includes(t.expect))
      out.push(`#${t.id} should be ${t.expect}, is "${t.classes}"`);
    if (t.needsSidewaysScroll) out.push(`#${t.id} still needs sideways scrolling`);
    if (t.cellsPastEdge)
      out.push(`#${t.id}: ${t.cellsPastEdge} cells are past the edge of the page`);
  }
  return out;
}
