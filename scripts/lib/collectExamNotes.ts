import { fetchTermDetail } from '@/api/termDetail';
import type { TermNote } from '@/api/terminyInfo';
import type { ExamSubject } from '@/types/exams';

// The extension's own detail-page paths cap themselves at three; so does this.
const MAX_CONCURRENT = 3;

/**
 * termId → the teacher's Poznámka (null: IS has none) for every term in the
 * exam list, read with the app's own `fetchTermDetail`.
 *
 * The app reads a note when a term is opened, from a live IS session the dev
 * webapp does not have — so without this the note never shows on localhost.
 * A term whose page fails to load is left out, not recorded as "no note".
 */
export async function collectExamNotes(
  exams: ExamSubject[],
  studium: string,
  obdobi: string
): Promise<Record<string, TermNote | null>> {
  const ids = new Set<string>();
  for (const subject of exams) {
    for (const section of subject.sections ?? []) {
      if (section.registeredTerm?.id) ids.add(section.registeredTerm.id);
      for (const term of section.terms ?? []) if (term.id) ids.add(term.id);
    }
  }
  const queue = [...ids];
  const notes: Record<string, TermNote | null> = {};
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        notes[id] = (await fetchTermDetail(id, studium, obdobi, 'cz')).note;
      } catch {
        // fetchTermDetail has logged it; the term simply has no entry.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, worker));
  return notes;
}
