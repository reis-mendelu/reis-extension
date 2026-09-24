import { stableDocumentKey } from '../../../api/documents/collapseAttachments';
import type { FolderListing } from '../../../api/documents/service';
import type { ParsedFile } from '../../../types/documents';

/**
 * What a subject's file list should be after a crawl, given what was cached.
 *
 * A complete crawl is the truth, deletions included. An incomplete one is
 * only a lower bound: a failed subfolder or page hides an unknown set of
 * files, so every cached file is kept and the crawl's rows are laid over
 * them. A file the teacher deleted during a failed crawl lingers until the
 * next complete one; a network blip never deletes anything.
 *
 * All-or-nothing on purpose. Keeping only the failed PART's files would need
 * to know which part a cached row came from, and rows do not say: `subfolder`
 * is the top-level folder's name for subfolder rows, but for root rows it is
 * IS's free-text label column, which can read like a folder name. Pages of
 * one folder are not told apart at all.
 *
 * Matched by `stableDocumentKey` — the IS document id — because a viewer
 * link's `serializace` token changes on every fetch.
 */
export function mergeFolderListing(
  previous: ParsedFile[] | undefined,
  listing: FolderListing
): ParsedFile[] {
  if (listing.complete || !previous?.length) return listing.files;
  const key = (f: ParsedFile) => stableDocumentKey(f.files, f.file_name);
  const fresh = new Set(listing.files.map(key));
  return [...listing.files, ...previous.filter((f) => !fresh.has(key(f)))];
}
