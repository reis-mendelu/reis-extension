// IS pads cells with U+00A0; normalise so label matches and regexes work.
// An escape, not a literal: a literal NBSP trips no-irregular-whitespace.
const NBSP = /\u00a0/g;

export const txt = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(NBSP, ' ').replace(/\s+/g, ' ').trim();

export const parseDoc = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');
