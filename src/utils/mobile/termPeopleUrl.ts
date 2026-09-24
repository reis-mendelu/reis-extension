import type { ExamTerm } from '../../types/exams';

/**
 * IS's own "Kdo jde se mnou na termín" page for one term, or null when we
 * cannot address it.
 *
 * Built from the term's own Podrobnosti link where IS gave one: its
 * studium/obdobi are the real ones, where the store's can be placeholders (the
 * dev webapp's "dev-studium", which IS answers with "Nekorektní použití
 * aplikace").
 */
export function termPeopleUrl(
  term: ExamTerm,
  studiumId: string | null,
  obdobiId: string | null,
  language: string
): string | null {
  if (term.detailUrl?.includes(`termin=${term.id}`)) {
    return term.detailUrl.replace(`termin=${term.id}`, `termin=${term.id};spoluzaci=1`);
  }
  if (!studiumId || !obdobiId) return null;
  return `https://is.mendelu.cz/auth/student/terminy_info.pl?termin=${term.id};spoluzaci=1;studium=${studiumId};obdobi=${obdobiId};lang=${language}`;
}
