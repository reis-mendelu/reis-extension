// The small pieces of the overview's answer that need no budget: how the study form, a
// deadline's order and one file's row are shown. Split from overviewRender.ts, which
// decides what fits.
import type { SubjectFile } from './files';
import { labelOf, modifiedOf } from './overviewGather';

const FORMS: Record<string, string> = {
  P: 'P (prezenční, full-time)',
  K: 'K (kombinované, combined)',
};
/** Sortable form of a DD.MM.YYYY HH:MM deadline; no date sorts last. */
export const deadlineKey = (d: string) => {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(d);
  return m
    ? `${m[3]}${m[2]!.padStart(2, '0')}${m[1]!.padStart(2, '0')}${(m[4] ?? '0').padStart(2, '0')}${m[5] ?? '00'}`
    : '9';
};

export function student(profile: Record<string, unknown> | null) {
  if (!profile) return undefined;
  const form = typeof profile.studyForm === 'string' ? profile.studyForm : '';
  return {
    programme: profile.studyProgram,
    form: form ? (FORMS[form] ?? form) : undefined,
    year: profile.studyYear,
    semester: profile.studySemester,
    faculty: profile.facultyLabel,
    period: profile.periodLabel,
  };
}

export function fileRows(
  files: SubjectFile[],
  marks: Map<string, string>,
  saved: (f: SubjectFile) => boolean
) {
  return files.map((f) => {
    const label = labelOf(f);
    return {
      file: label,
      // The document's own title, only when it says more than the file's name.
      ...(f.name && f.name !== label.replace(/\.[^.]+$/, '') ? { title: f.name } : {}),
      modified: modifiedOf(f),
      ...(saved(f) ? { textSaved: 'yes' } : {}),
      ...(marks.has(f.downloadUrl) ? { changed: marks.get(f.downloadUrl) } : {}),
      url: f.downloadUrl,
    };
  });
}
