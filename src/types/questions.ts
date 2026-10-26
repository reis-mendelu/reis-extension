/**
 * A question reIS asks in Novinky (`reis_questions`, 20261024120000). Written in
 * the admin console, live between `startsAt` and `endsAt`, and shown by builds
 * from 5.5.0 on. See docs/superpowers/specs/2026-10-22-novinky-questions-design.md.
 */
export interface QuestionButton {
  /** Counted as-is. Never 'seen', which is the denominator. */
  key: string;
  cz: string;
  en: string;
  /** A link button: counted, then opened. Answer buttons have none. */
  url?: string;
  /**
   * With `url`: share the link instead of opening it. The share sheet on the
   * phone and iPad, a copied link on the extension (`shareLink`).
   */
  share?: boolean;
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
  /** Drawn in the row's icon slot instead of the question mark. */
  icon?: QuestionIcon | null;
  /** How a 1–5 scale is drawn: 'stars' like a Google Play rating, else buttons. */
  display?: QuestionDisplay | null;
}

/** The scale styles a client knows how to draw (`reis_questions.display`'s CHECK). */
export type QuestionDisplay = 'stars';

/** The icons a client knows how to draw (`reis_questions.icon`'s CHECK). */
export type QuestionIcon = 'google_play';

/** What a device counts: the question was on screen, or one of its buttons. */
export type QuestionCountKey = 'seen' | string;
