import { mergeDualLanguageLessons } from '../schedule';
import type { BlockLesson } from '../../types/schedule';
import { ImpersonationError, type ImpersonationSelection } from './types';
import { timetableBody, readTimetableAnswer, type TimetableFilter } from './timetableQuery';
import { post } from './transport';

/**
 * One timetable query in both languages, or failure: a half-fetched timetable
 * is never applied. Shared by the programme personas (fetchImpersonation) and
 * the Erasmus persona (fetchExchange).
 */
export async function lessonsFor(
  sel: Pick<ImpersonationSelection, 'rozvrh'>,
  f: TimetableFilter,
  pick: (lessons: BlockLesson[]) => BlockLesson[]
): Promise<BlockLesson[]> {
  const [cz, en] = await Promise.all(
    (['cz', 'en'] as const).map(async (lang) =>
      readTimetableAnswer(await post(timetableBody(sel.rozvrh, f, lang, 'json')))
    )
  );
  if (!cz || !en || cz.kind === 'failed' || en.kind === 'failed')
    throw new ImpersonationError('timetable');
  const czL = cz.kind === 'lessons' ? cz.lessons : [];
  const enL = en.kind === 'lessons' ? en.lessons : [];
  return mergeDualLanguageLessons(pick(czL), enL);
}
