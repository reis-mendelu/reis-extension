export type AttemptType = 'regular' | 'retake1' | 'retake2' | 'retake3';

/** IS Mendelu's icon id for each attempt type, in the "Typ termínu" cell. */
export const ATTEMPT_BY_SYSID: Record<string, AttemptType> = {
  'termin-radny': 'regular',
  'termin-opravny-1': 'retake1',
  'termin-opravny-2': 'retake2',
  'termin-opravny-3': 'retake3',
};

/**
 * The icon ids inside `el`, in document order, across both markups IS has
 * served: `<img sysid="…">` before, `<span class="uf-icon" data-sysid="…">`
 * wrapping an inline SVG now (observed 2026-09-22 on terminy_seznam.pl). Only
 * the old one was read, so every term lost its attempt type and its
 * Podrobnosti link at once. Same two-markup rule as api/documents/iconSysid.
 */
export function iconSysids(el: Element): string[] {
  const out: string[] = [];
  el.querySelectorAll('[data-sysid], img[sysid]').forEach((icon) => {
    const id = icon.getAttribute('data-sysid') || icon.getAttribute('sysid');
    if (id) out.push(id);
  });
  return out;
}
