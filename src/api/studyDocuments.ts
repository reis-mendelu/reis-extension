import { BASE_URL } from './client';

export interface StudyDocument {
  id: string;
  /** i18n key under `documents.items.*` for the row label. */
  labelKey: string;
  /** IS trigger flag, e.g. `potvrzeni_tisk_el=1`. Sealed wherever one exists. */
  trigger: string;
  /** Unsealed equivalent, tried only when the sealed one returns a page instead
   *  of a file. Absent when `trigger` is already the plain variant. */
  fallbackTrigger?: string;
  /** Present ⇒ append `;jazyk=eng` so the document *content* is English. */
  contentLang?: 'eng';
  /** Filename handed to the browser's download manager. */
  filename: string;
}

/**
 * One-click study documents on IS's "Tisk dokumentů" page. All return a
 * synchronous `application/pdf` on a single GET (verified 2026-07-05).
 *
 * The sealed (`_el`) variant is preferred wherever it exists — it is instant,
 * carries the electronic seal that makes offices accept the document, and files
 * a copy into Úložiště dokumentů.
 *
 * `fallbackTrigger` is the unsealed equivalent, used only when the sealed
 * endpoint answers with a page instead of a file. That is not hypothetical: on
 * 2026-08-03 every sealed endpoint began returning "Request body constraint
 * violation" — for plain desktop browsers too, so it is a MENDELU-side fault
 * reIS cannot fix. An unsealed document beats no document, and the UI tells the
 * student which one they got. See memory `tisk-dokumentu-catalog`.
 */
export const STUDY_DOCUMENTS: StudyDocument[] = [
  { id: 'potvrzeni-cz', labelKey: 'confirmationCz', trigger: 'potvrzeni_tisk_el=1', fallbackTrigger: 'potvrzeni_tisk=1', filename: 'Potvrzeni_o_studiu.pdf' },
  { id: 'potvrzeni-en', labelKey: 'confirmationEn', trigger: 'potvrzeni_tisk_el=1', fallbackTrigger: 'potvrzeni_tisk=1', contentLang: 'eng', filename: 'Confirmation_of_study.pdf' },
  { id: 'prehled-cz', labelKey: 'overviewCz', trigger: 'prehled_tisk_el=1', fallbackTrigger: 'prehled_tisk=1', filename: 'Prehled_studia.pdf' },
  { id: 'prehled-en', labelKey: 'overviewEn', trigger: 'prehled_tisk_el=1', fallbackTrigger: 'prehled_tisk=1', contentLang: 'eng', filename: 'Study_overview.pdf' },
  // The registration sheet has no sealed variant, so this IS the plain one.
  { id: 'reg-arch', labelKey: 'regArch', trigger: 'reg_arch_tisk=1', filename: 'Registracni_arch.pdf' },
];

/** Build a direct-download URL. `lang=cz` only affects IS UI chrome (irrelevant to a download). */
export function buildDocumentUrl(sid: string, doc: StudyDocument): string {
  return buildTriggerUrl(sid, doc, doc.trigger);
}

/** The unsealed URL to retry with, or null when this document has no sealed variant. */
export function buildFallbackDocumentUrl(sid: string, doc: StudyDocument): string | null {
  return doc.fallbackTrigger ? buildTriggerUrl(sid, doc, doc.fallbackTrigger) : null;
}

function buildTriggerUrl(sid: string, doc: StudyDocument, trigger: string): string {
  const jazyk = doc.contentLang ? `;jazyk=${doc.contentLang}` : '';
  return `${BASE_URL}/auth/student/tisk_dokumentu.pl?${trigger}${jazyk};studium=${sid};lang=cz`;
}

/** The Žádost form (needs typed input) — opened in a new tab, not downloaded. */
export function buildZadostUrl(sid: string, lang: string): string {
  return `${BASE_URL}/auth/student/zadost.pl?studium=${sid};lang=${lang}`;
}
