import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';

/**
 * Who is shown each study-aids link: `study_aids` id -> audience tokens.
 *
 * An anonymous select, filtered on the device. RLS returns only the rows the
 * admin has switched on, so a link that is off is simply absent. Nothing goes
 * up: not the student's faculty or programme, which the device matches against
 * these tokens itself.
 */
const RowSchema = z.object({ id: z.string(), audience: z.array(z.string()) });

/** The active audiences, or `null` when the answer is not known (see `fetchQuestions`). */
export async function fetchStudyAids(): Promise<Record<string, string[]> | null> {
  try {
    const { data, error } = await supabase.from('study_aids').select('id, audience');
    if (error || !Array.isArray(data)) {
      if (error) logError('Api.fetchStudyAids', error);
      return null;
    }
    // Row by row: one malformed row must not hide the others.
    return Object.fromEntries(
      data.flatMap((raw) => {
        const r = RowSchema.safeParse(raw);
        return r.success ? [[r.data.id, r.data.audience] as const] : [];
      })
    );
  } catch (err) {
    logError('Api.fetchStudyAids', err);
    return null;
  }
}
