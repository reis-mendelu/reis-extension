import type { ExamTerm } from '../../types/exams';
import type { TermNote } from '../../api/terminyInfo';

export interface SectionFactsInput {
  terms: ExamTerm[];
  language: string;
  /** Store's `examTermDurations`: lengths read by the note request. */
  durations: Record<string, number | null | undefined>;
  /** Store's `examNotes`: undefined = not read yet, null = no note. */
  notes: Record<string, TermNote | null | undefined>;
  /** Store's `examNotesLoading`. */
  loading: Record<string, boolean | undefined>;
  /** Store's `examNotesError`. */
  errors: Record<string, string | undefined>;
}

export interface SectionFacts {
  room?: string;
  form?: string;
  minutes?: number;
  note?: TermNote;
  /** A term's page is still being read: its length or note may yet arrive. */
  waiting: boolean;
  /** Every term's page has been read, so a missing fact is IS's answer. */
  allRead: boolean;
  /** A term's page could not be read: a missing note may be ours, not IS's. */
  failed: boolean;
}

/** The one value every item has, or undefined when any is missing or differs. */
function agreed<T>(
  values: (T | null | undefined)[],
  key: (v: T) => string = String
): T | undefined {
  const first = values[0];
  if (first == null) return undefined;
  const k = key(first);
  return values.every((v) => v != null && key(v) === k) ? first : undefined;
}

/**
 * What a card's single "Více" may say: only what holds for every term in it.
 *
 * Form, length, room and the teacher's Poznámka are all per term in IS. Read
 * off the first term and shown for the card, any of them is wrong for the
 * terms that differ. So each one shows only when all terms agree, and a term
 * with no value counts as differing, not as agreeing.
 */
export function sectionFacts({
  terms,
  language,
  durations,
  notes,
  loading,
  errors,
}: SectionFactsInput): SectionFacts {
  const en = language === 'en';
  return {
    room: agreed(terms.map((t) => (en ? t.roomEn : t.roomCs) || t.room)),
    form: agreed(terms.map((t) => (en ? t.sectionFormEn : t.sectionFormCs) || t.sectionForm)),
    minutes: agreed(terms.map((t) => t.durationMinutes ?? durations[t.id])),
    note: agreed(
      terms.map((t) => notes[t.id]),
      (n) => `${n.isEmphasized}|${n.text.trim()}`
    ),
    waiting: terms.some((t) => loading[t.id]),
    allRead: terms.every((t) => notes[t.id] !== undefined),
    failed: terms.some((t) => errors[t.id]),
  };
}
