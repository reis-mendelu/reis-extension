/**
 * A question reIS asks in Novinky (`reis_questions`, 20261025120000). Written in
 * the admin console, live between `startsAt` and `endsAt`, and shown by builds
 * after 5.5.0 only. See docs/superpowers/specs/2026-10-22-novinky-questions-design.md.
 */
export interface QuestionButton {
  /** Counted as-is. Never 'seen', which is the denominator. */
  key: string;
  cz: string;
  en: string;
  /** A link button: counted, then opened. Answer buttons have none. */
  url?: string;
  /** What this end of a scale means ("nejhorší" under 1), shown under it. */
  hintCz?: string;
  hintEn?: string;
}

export interface Question {
  id: string;
  promptCz: string;
  promptEn: string;
  noteCz: string | null;
  noteEn: string | null;
  buttons: QuestionButton[];
  /** ISO timestamps. */
  startsAt: string;
  endsAt: string;
  /** Faculty keys ('pef', 'af', …) as `useViewer` knows them; null = everyone. Decided on the device. */
  faculties: string[] | null;
}

/** What a device counts: the question was on screen, or one of its buttons. */
export type QuestionCountKey = 'seen' | string;
