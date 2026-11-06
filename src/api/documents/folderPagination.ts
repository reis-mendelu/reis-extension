const ON = /([?;])on=(\d+)/;

/** 100 pages of ten is 1,000 documents, past any subject folder in IS. */
const MAX_PAGE_INDEX = 99;

/**
 * Every OTHER page of a dok_server folder listing, as links IS itself printed
 * with only `on=` changed — or null when the page has no IS page bar.
 *
 * IS lists ten documents a page in `<ul class="paginator">`. What real
 * captures showed (fixtures `slozka-*.cz.html`), and why a page is identified
 * by its `on=` value and never by its label:
 *  - a page holding one document is labelled "11", not "11–11";
 *  - the bar is windowed: a 96-document folder links pages by label only up
 *    to "41–50", then "…", and the last page only through the →| arrow;
 *  - disabled arrows still carry an `on=` (`data-active="false"`): on page 1
 *    "previous" is `on=-1`, and on the last page "next" points one past it.
 * So: the highest `on=` among live links is the last page, and every page up
 * to it is requested. Past the cap, `truncated` says so: a caller that treats
 * the listing as the whole folder would otherwise read the rest as deleted.
 */
export function folderPageLinks(doc: Document): { links: string[]; truncated: boolean } | null {
  const bar = doc.querySelector('ul.paginator');
  if (!bar) return null;

  let current = 0;
  let last = 0;
  let template: string | undefined;
  for (const a of Array.from(bar.querySelectorAll('a[href]'))) {
    if (a.getAttribute('data-active') === 'false') continue;
    const href = a.getAttribute('href') ?? '';
    const on = href.match(ON)?.[2];
    if (on === undefined) continue;
    const n = Number(on);
    if (a.getAttribute('data-selected') === 'true') current = n;
    if (n >= last) {
      last = n;
      template = href;
    }
  }
  if (!template) return { links: [], truncated: false };

  const links: string[] = [];
  for (let n = 0; n <= Math.min(last, MAX_PAGE_INDEX); n++) {
    if (n !== current) links.push(template.replace(ON, `$1on=${n}`));
  }
  return { links, truncated: last > MAX_PAGE_INDEX };
}
