// The planning half of mendelu_build_my_map, split from buildMap.ts: the subject list and each
// subject's listing, read through the tool cache like the overview reads them (so each file's
// date is noted), and which files the store already holds for that date.
import { listFolderFiles, type SubjectFile } from './files';
import { subjectsData } from './tools';
import { stampOf } from './cache';
import { createOriginals } from './storeOriginals';
import type { Planned } from './buildReport';
import type { BuildDeps } from './buildMap';

export async function pool<T>(items: T[], n: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** The subjects and their listings, read the way the overview reads them. */
export async function plan(
  d: Pick<BuildDeps, 'ctx' | 'run' | 'store'>
): Promise<{ planned: Planned[]; problems: string[]; codes: string[] }> {
  const data = await subjectsData(d.ctx);
  const originals = createOriginals(d.store);
  const planned: Planned[] = [];
  const problems: string[] = [];
  await pool(Object.entries(data), 4, async ([code, s]) => {
    if (typeof s.folderUrl !== 'string') return;
    const folderUrl = s.folderUrl;
    let files: SubjectFile[];
    try {
      files = (await d.run('mendelu_subject_files', { code }, () =>
        listFolderFiles(folderUrl)
      )) as SubjectFile[];
    } catch (e) {
      problems.push(
        `files of ${code}: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`
      );
      return;
    }
    for (const f of files) {
      const stamp = stampOf(f);
      planned.push({ code, file: f, stamp, kept: !!(await originals.kept(f.downloadUrl, stamp)) });
    }
  });
  planned.sort((a, b) => a.code.localeCompare(b.code));
  // Every enrolled subject is reported, an empty folder (or none) as zero files.
  return { planned, problems, codes: Object.keys(data).sort() };
}
