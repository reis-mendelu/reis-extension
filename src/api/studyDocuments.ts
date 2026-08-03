import { BASE_URL } from './client';

export interface StudyDocument {
  id: string;
  /** i18n key under `documents.items.*` for the row label. */
  labelKey: string;
  /** IS trigger flag, e.g. `potvrzeni_tisk_el=1`. */
  trigger: string;
  /** Present ⇒ append `;jazyk=eng` so the document *content* is English. */
  contentLang?: 'eng';
  /** Filename handed to the browser's download manager. */
  filename: string;
}

/**
 * One-click study documents on IS's "Tisk dokumentů" page. All return a
 * synchronous `application/pdf` on a single GET.
 *
 * **Do not switch these to the sealed (`_el`) triggers.** An earlier version did,
 * on the belief that `_el` was instant AND carried the electronic seal. Measured
 * against live IS on 2026-08-03, that is false on both counts:
 *
 *   - `_el` over GET answers 200 `text/html` with "Operaci se nepodařilo úspěšně
 *     dokončit. Request body constraint violation" — IS wants a POST body.
 *   - Sealing is not a download at all. That page states the sealed document is
 *     produced asynchronously and "do hodiny jej naleznete v aplikaci Úložiště
 *     dokumentů" — within an hour, in the document repository.
 *
 * The failure is worse than a dead button: `downloadDocumentInPage` reads a
 * non-PDF 200 as an expired session, so the content script force-navigates the
 * student to the IS login page.
 *
 * Offering sealed copies needs POST support plus a repository pickup flow, and
 * cannot be one tap. See memory `tisk-dokumentu-catalog`.
 */
export const STUDY_DOCUMENTS: StudyDocument[] = [
  { id: 'potvrzeni-cz', labelKey: 'confirmationCz', trigger: 'potvrzeni_tisk=1', filename: 'Potvrzeni_o_studiu.pdf' },
  { id: 'potvrzeni-en', labelKey: 'confirmationEn', trigger: 'potvrzeni_tisk=1', contentLang: 'eng', filename: 'Confirmation_of_study.pdf' },
  { id: 'prehled-cz', labelKey: 'overviewCz', trigger: 'prehled_tisk=1', filename: 'Prehled_studia.pdf' },
  { id: 'prehled-en', labelKey: 'overviewEn', trigger: 'prehled_tisk=1', contentLang: 'eng', filename: 'Study_overview.pdf' },
  { id: 'reg-arch', labelKey: 'regArch', trigger: 'reg_arch_tisk=1', filename: 'Registracni_arch.pdf' },
];

/** Build a direct-download URL. `lang=cz` only affects IS UI chrome (irrelevant to a download). */
export function buildDocumentUrl(sid: string, doc: StudyDocument): string {
  const jazyk = doc.contentLang ? `;jazyk=${doc.contentLang}` : '';
  return `${BASE_URL}/auth/student/tisk_dokumentu.pl?${doc.trigger}${jazyk};studium=${sid};lang=cz`;
}

/** The Žádost form (needs typed input) — opened in a new tab, not downloaded. */
export function buildZadostUrl(sid: string, lang: string): string {
  return `${BASE_URL}/auth/student/zadost.pl?studium=${sid};lang=${lang}`;
}
