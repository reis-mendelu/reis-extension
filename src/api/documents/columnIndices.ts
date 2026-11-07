/**
 * Maps table header names to their corresponding column indices.
 *
 * Moved out of parser.ts unchanged. These indices are load-bearing — a one-off
 * change silently breaks production data — so this is a pure relocation: the
 * matching order, the `=== undefined` first-wins guards and the header strings
 * are byte-for-byte what the parser has always run.
 */
export function getColumnIndices(table: Element): Record<string, number> {
  const indices: Record<string, number> = {};
  const headers = Array.from(table.querySelectorAll('thead th, tr.zahlavi th, tr.zahlavi td'));

  headers.forEach((th, i) => {
    const text = th.textContent?.trim().toLowerCase() || '';
    if ((text.includes('název') || text.includes('name')) && indices.name === undefined)
      indices.name = i;
    else if (
      (text.includes('vložil') || text.includes('entered by')) &&
      indices.author === undefined
    )
      indices.author = i;
    else if (
      (text.includes('datum dokumentu') || text.includes('document date')) &&
      indices.date === undefined
    )
      indices.date = i;
    else if (
      text.includes('poslední změna') ||
      text.includes('last change') ||
      text.includes('modifikace') ||
      text.includes('modification')
    ) {
      if (indices.date === undefined) indices.date = i;
      // Added 2026-11: with a document date already found, this column is
      // IS's Modifikace (en: "Modifications"). `date` is untouched either way.
      else if (indices.modified === undefined) indices.modified = i;
    } else if (
      (text.includes('komentář') || text.includes('comment')) &&
      indices.comment === undefined
    )
      indices.comment = i;
    else if (
      (text.includes('ozn.') || text.includes('subfolder')) &&
      indices.subfolder === undefined
    )
      indices.subfolder = i;
  });

  return indices;
}
