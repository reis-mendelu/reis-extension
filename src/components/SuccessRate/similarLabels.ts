import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';

type T = (key: string, params?: Record<string, string | number>) => string;

/** Reasons the UI knows how to say; an unknown one from a newer file is skipped. */
export const KNOWN_REASONS = [
  'sameName',
  'sameGuarantor',
  'sameTeachers',
  'sameLiterature',
] as const;

export const knownReasons = (s: SimilarSuggestion) =>
  KNOWN_REASONS.filter((r) => s.reasons.includes(r));

/** "stejný název, garant a vyučující": one phrase instead of a pill per reason. */
export function reasonPhrase(s: SimilarSuggestion, t: T): string {
  const nouns = knownReasons(s).map((r) => t(`successRate.reasonNoun.${r}`));
  if (!nouns.length) return '';
  const list =
    nouns.length === 1
      ? nouns[0]!
      : `${nouns.slice(0, -1).join(', ')}${t('successRate.and')}${nouns[nouns.length - 1]!}`;
  return t('successRate.same', { list });
}

/** The completion change, from the OLD subject's type: "dříve zápočet, nyní zkouška". */
export function changeNote(s: SimilarSuggestion, t: T): string | null {
  if (!s.completionChanged || !s.completion) return null;
  return t(s.completion === 'credit' ? 'successRate.wasCredit' : 'successRate.wasExam');
}

/** Said once above the list when every suggestion carries the same change. */
export function sharedChangeNote(list: SimilarSuggestion[], t: T): string | null {
  const notes = list.map((s) => changeNote(s, t));
  const first = notes[0];
  return list.length > 1 && first && notes.every((n) => n === first) ? first : null;
}

/** "2020/21" when the old subject last ran before last academic year, else null. */
export function staleYear(lastYear: number | null, now = new Date()): string | null {
  if (lastYear === null) return null;
  const currentStart = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  if (lastYear >= currentStart - 1) return null;
  return `${lastYear}/${String((lastYear + 1) % 100).padStart(2, '0')}`;
}

export const displayName = (s: SimilarSuggestion, language: string) =>
  language === 'en' && s.nameEn ? s.nameEn : s.nameCs;
