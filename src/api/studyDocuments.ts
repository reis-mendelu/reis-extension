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
 * synchronous `application/pdf` on a single GET (verified 2026-07-05). The
 * sealed (`_el`) variant is used wherever it exists — it is instant AND
 * carries the electronic seal. See memory `tisk-dokumentu-catalog`.
 */
export const STUDY_DOCUMENTS: StudyDocument[] = [
  { id: 'potvrzeni-cz', labelKey: 'confirmationCz', trigger: 'potvrzeni_tisk_el=1', filename: 'Potvrzeni_o_studiu.pdf' },
  { id: 'potvrzeni-en', labelKey: 'confirmationEn', trigger: 'potvrzeni_tisk_el=1', contentLang: 'eng', filename: 'Confirmation_of_study.pdf' },
  { id: 'prehled-cz', labelKey: 'overviewCz', trigger: 'prehled_tisk_el=1', filename: 'Prehled_studia.pdf' },
  { id: 'prehled-en', labelKey: 'overviewEn', trigger: 'prehled_tisk_el=1', contentLang: 'eng', filename: 'Study_overview.pdf' },
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
