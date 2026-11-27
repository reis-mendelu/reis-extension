import { fetchWithAuth } from './client';
import { getUserParams } from '../utils/userParams';
import { logError } from '../utils/reportError';
import type { ExamActionResult } from './exams';

// Its own file, not part of exams.ts: reIS for Claude imports exams.ts, and
// nothing it can reach may register or change an exam (mcpStaysReadOnly.test.ts).

/**
 * Move a registration from `oldTermId` to `newTermId` with IS's own swap.
 *
 * Asked to register a term while the student holds another of the same kind,
 * IS shows a confirmation ("budete z původního termínu odhlášeni") whose form
 * names the term being left in `odhlas_termin`. Pressing it registers the new
 * term and drops the old one as ONE operation (verified live, 2026-11-25), so
 * unlike unregister-then-register there is no moment without a seat. This
 * posts that same form. `success` only says IS reported the operation done;
 * the caller reads the list back for the truth.
 */
export async function swapExamTerm(
  oldTermId: string,
  newTermId: string
): Promise<ExamActionResult> {
  try {
    const params = await getUserParams();
    if (!params?.studium) {
      return { success: false, error: 'Chybí údaje o studiu. Zkuste obnovit stránku.' };
    }
    const body = new URLSearchParams({
      lang: 'cz',
      termin: newTermId,
      studium: params.studium,
      obdobi: String(params.obdobi),
      odhlas_termin: oldTermId,
      odhlasit_prihlasit: 'Přihlásit na termín',
    });
    const response = await fetchWithAuth(
      'https://is.mendelu.cz/auth/student/terminy_prihlaseni.pl',
      { method: 'POST', body: body.toString() }
    );
    const html = await response.text();
    if (html.includes('Operace byla úspěšně provedena')) return { success: true };
    return { success: false, error: 'Změna termínu se nepodařila ověřit. Zkontrolujte v IS.' };
  } catch (error) {
    logError('Api.swapExamTerm', error);
    return { success: false, error: 'Chyba připojení. Zkuste to znovu.' };
  }
}
