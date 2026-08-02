import type { FileAttachment } from '../../types/documents';

/**
 * IS lists every document twice in a folder row: once as a `dokumenty_cteni.pl`
 * VIEWER page and once as a `slozka.pl?download=` direct file. Both carry the
 * same document id (verified against a live folder page: `dok=359057` and
 * `download=359057` are the same document).
 *
 * The parser faithfully collects both anchors, so rendering one row per
 * attachment showed every file twice, as "Name (1)" and "Name (2)".
 *
 * This collapses the pair into the single row a student expects, preferring the
 * DIRECT DOWNLOAD link — reIS downloads files, it does not send people into the
 * old IS UI.
 *
 * It deliberately does NOT dedupe by filename: IS legitimately serves many
 * distinct documents with the same display name, and collapsing those would
 * hide real files. Only attachments proven to be the same document by id are
 * merged; anything without an id is kept as-is.
 */
export function collapseAttachments(files: FileAttachment[]): FileAttachment[] {
  const out: FileAttachment[] = [];
  const byDocId = new Map<string, number>();

  for (const file of files) {
    const id = documentIdOf(file.link);
    if (!id) {
      out.push(file);
      continue;
    }

    const existing = byDocId.get(id);
    if (existing === undefined) {
      byDocId.set(id, out.length);
      out.push(file);
      continue;
    }

    // Same document seen twice — keep whichever entry is the direct download,
    // and keep a real mime type over the other entry's 'unknown'.
    const kept = out[existing];
    if (!kept) {
      // Unreachable: every index in the map came from an out.push above. Kept
      // as a push rather than a throw so a future refactor loses no file.
      out.push(file);
      continue;
    }

    const preferred = isDirectDownload(file.link) ? file : kept;
    const other = preferred === file ? kept : file;
    out[existing] = {
      ...preferred,
      type: preferred.type !== 'unknown' ? preferred.type : other.type,
    };
  }

  return out;
}

function documentIdOf(link: string): string | null {
  return link.match(/[?;&]download=(\d+)/)?.[1] ?? link.match(/[?;&]dok=(\d+)/)?.[1] ?? null;
}

function isDirectDownload(link: string): boolean {
  return /[?;&]download=\d+/.test(link);
}

/**
 * A dedup key for a parsed row that is STABLE across fetches.
 *
 * The obvious key — the first attachment's URL — is not: IS's viewer links
 * carry a `serializace` token that embeds a timestamp, so the same document
 * fetched twice (pagination, or a subfolder that repeats a parent's rows)
 * produces two different URLs and therefore survives deduplication twice.
 * Measured: two fetches 3 s apart returned
 * `dok=359057;serializace=203444766:1785673475:…` and
 * `…203444776:1785673478:…` for the same document.
 *
 * The document id is stable, so key on that. Falls back to the raw link only
 * when no id can be found, which preserves the previous behaviour for shapes
 * this does not recognise.
 */
export function stableDocumentKey(files: FileAttachment[], fileName: string): string {
  for (const f of files) {
    const id = documentIdOf(f.link);
    if (id) return `doc:${id}`;
  }
  return `${files[0]?.link ?? ''}_${fileName}`;
}
