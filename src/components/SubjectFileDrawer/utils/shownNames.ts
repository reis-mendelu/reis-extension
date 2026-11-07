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
 * a dot between words is what the cleaning removes. A list is one document's
 * files, or one folder's single-file documents; a null is a row that is not in
 * it and comes back undefined.
 */
export function shownNames(rows: (ShownRow | null)[]): (string | undefined)[] {
  const pretty = rows.map((row) =>
    row ? (row.kind === 'file' ? prettifyFileName(row.name) : prettifyTitle(row.name)) : undefined
  );
  const counts = new Map<string, number>();
  for (const p of pretty) if (p !== undefined) counts.set(p, (counts.get(p) ?? 0) + 1);
  return pretty.map((p, i) => {
    const ext = rows[i]?.ext;
    return p !== undefined && ext && (counts.get(p) ?? 0) > 1 ? `${p} (${ext})` : p;
  });
}

/** A file's extension from its own name, else IS's type; never 'unknown'. */
export function rowExtension(file: Pick<FileAttachment, 'type' | 'filename'>): string | undefined {
  return (
    fileExtension(file.filename) ?? (file.type && file.type !== 'unknown' ? file.type : undefined)
  );
}
