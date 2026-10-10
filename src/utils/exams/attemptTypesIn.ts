import type { ExamTerm } from '../../types/exams';

export type AttemptType = NonNullable<ExamTerm['attemptTypes']>[number];

const ATTEMPT_ORDER: readonly AttemptType[] = ['regular', 'retake1', 'retake2', 'retake3'];

/**
 * The attempt types a list of terms carries, each once, in attempt order.
 *
 * Feeds the legend under a subject's term list on both trees, so it names only
 * the marks that are actually on screen: a subject with nothing but regular
 * terms gets one entry, not four. Empty when IS listed no type at all.
 */
export function attemptTypesIn(terms: readonly ExamTerm[]): AttemptType[] {
  const present = new Set(terms.flatMap((term) => term.attemptTypes ?? []));
  return ATTEMPT_ORDER.filter((type) => present.has(type));
}
