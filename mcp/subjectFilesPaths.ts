// mendelu_subject_files with the saved originals' paths: the overview points here when it cuts a
// subject's file list, so every saved file must stay locatable from this answer too. Same rules
// as the overview (overviewTool.ts savedOriginals): a `localPath` only when the original is on
// disk and current for the date IS shows, relative to one absolute folder named once. What the
// cache and the store keep is the plain listing: the paths are added to this answer only.
import type { Store } from './store';
import type { SubjectFile } from './files';
import { stampOf } from './cache';
import { createOriginals, metaPath } from './storeOriginals';
import { CHARACTER_LIMIT, type ResponseFormat } from './format';
import { toMarkdown } from './markdown';

type Row = SubjectFile & { localPath?: string };

const sizeOf = (o: unknown, format: ResponseFormat) =>
  format === 'json' ? JSON.stringify(o, null, 2).length : toMarkdown(o).length;

const shape = (rows: Row[], folder: string, left: number) => ({
  savedFiles: `Each file with a localPath is saved on this computer: its full path is ${folder} joined with its localPath.`,
  ...(left
    ? {
        pathsLeftOut: `${left} more saved file(s) did not fit with their path here: mendelu_read_file answers those from the saved copy without downloading`,
      }
    : {}),
  files: rows,
});

/**
 * The listing as the tool returns it when nothing is saved; with the paths and the folder
 * when something is. The paths never push an answer that fitted over the size budget: the
 * author column goes first, then paths from the end of the list, and the cut is said.
 */
export async function withLocalPaths(store: Store, value: unknown, format: ResponseFormat) {
  if (!Array.isArray(value)) return value;
  const files = value as SubjectFile[];
  const stored = new Set((await store.list()).map((e) => e.path));
  const originals = createOriginals(store);
  const paths: (string | undefined)[] = [];
  for (const f of files) {
    const ok = !!f.modified && stored.has(metaPath(f.downloadUrl));
    paths.push(ok ? await originals.kept(f.downloadUrl, stampOf(f)) : undefined);
  }
  if (!paths.some(Boolean)) return value;
  const limit = CHARACTER_LIMIT - 300;
  // Already over the budget without paths: the cut is format.ts's, as it always was.
  const fitsAlone = sizeOf(files, format) <= limit;
  const build = (withPaths: number, dropAuthor: boolean) => {
    let given = 0;
    const rows = files.map((f, i) => {
      const { author: _a, ...rest } = f;
      const row: Row = dropAuthor ? (rest as Row) : { ...f };
      if (paths[i] && given < withPaths) {
        given++;
        row.localPath = paths[i];
      }
      return row;
    });
    const all = paths.filter(Boolean).length;
    return shape(rows, store.dir, all - given);
  };
  const total = paths.filter(Boolean).length;
  if (!fitsAlone) return build(total, false);
  for (const dropAuthor of [false, true]) {
    const whole = build(total, dropAuthor);
    if (sizeOf(whole, format) <= limit) return whole;
  }
  let [lo, hi] = [0, total];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (sizeOf(build(mid, true), format) <= limit) lo = mid;
    else hi = mid - 1;
  }
  return build(lo, true);
}
