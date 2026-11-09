import type { FileAttachment } from '../../../types/documents';
import { fileExtension, prettifyFileName, prettifyTitle } from '../../../utils/documentLabels';

export interface ShownRow {
  /** The real name: a file name for a file under a document, else the document title. */
  name: string;
  kind: 'file' | 'title';
  /** Shown only when another row in the same list would read the same. */
  ext?: string;
}

/**
 * What each row of one list shows: the cleaned name (prettifyFileName,
 * prettifyTitle), plus its extension where two rows would otherwise read the
 * same. Dominik, 2026-11-07: "same name, different file"; instrukce.md and
 * instrukce.docx both read "instrukce", so those two become "instrukce (md)"
 * and "instrukce (docx)" and every unique name stays bare. "(md)" over ".md":
 * a dot between words is what the cleaning removes. Rows still alike after
 * that (same extension too) show their real names. A list is one document's
 * files, or one folder's single-file documents; a null is a row that is not in
 * it and comes back undefined.
 */
export function shownNames(rows: (ShownRow | null)[]): (string | undefined)[] {
  const pretty = rows.map((row) =>
    row ? (row.kind === 'file' ? prettifyFileName(row.name) : prettifyTitle(row.name)) : undefined
  );
  const clashes = countOf(pretty);
  const withExt = pretty.map((p, i) => {
    const ext = rows[i]?.ext;
    return p !== undefined && ext && (clashes.get(p) ?? 0) > 1 ? `${p} (${ext})` : p;
  });
  // Still alike: same cleaned name and same extension ("instrukce_v1.md",
  // "instrukce-v1.md"), or a label that meets another row's real name. Those
  // rows show their real names, which differ within one folder.
  const still = countOf(withExt);
  const fallback = withExt.map((w, i) =>
    w !== undefined && w !== pretty[i] && (still.get(w) ?? 0) > 1 ? rows[i]?.name : w
  );
  const last = countOf(fallback);
  return fallback.map((f, i) => (f !== undefined && (last.get(f) ?? 0) > 1 ? rows[i]?.name : f));
}

function countOf(values: (string | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** A file's extension from its own name, else IS's type; never 'unknown'. */
export function rowExtension(file: Pick<FileAttachment, 'type' | 'filename'>): string | undefined {
  return (
    fileExtension(file.filename) ?? (file.type && file.type !== 'unknown' ? file.type : undefined)
  );
}
