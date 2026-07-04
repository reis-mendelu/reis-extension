import { injectUserParams } from './pages/types';

/**
 * Static catalog of printable IS Mendelu study documents, mirroring the two
 * sections of `student/tisk_dokumentu.pl` (verified by scrape 2026-07-04).
 *
 * Each icon on that page is a plain GET `<a href>` needing only the student's
 * `studium` id + `lang`; `obdobi` is not required. English *content* variants
 * carry a fixed `jazyk=eng`, independent of the UI `lang`.
 */

/** `sealed` = e-sealed official doc, generated into Úložiště within ~1h (not instant). */
export type StudyDocumentSection = 'sealed' | 'plain';

export interface StudyDocument {
  id: string;
  label: { cs: string; en: string };
  section: StudyDocumentSection;
  /** Absolute URL with `{{studium}}` and `{{lang}}` placeholders. */
  href: string;
}

const STUDENT = 'https://is.mendelu.cz/auth/student';
const STUDIJNI = 'https://is.mendelu.cz/auth/studijni';

export const STUDY_DOCUMENTS: StudyDocument[] = [
  // --- Elektronicky pečetěné dokumenty (official, e-sealed) ---
  {
    id: 'potvrzeni-sealed',
    label: { cs: 'Potvrzení o studiu', en: 'Proof of study' },
    section: 'sealed',
    href: `${STUDENT}/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'potvrzeni-sealed-en',
    label: { cs: 'Potvrzení o studiu (anglicky)', en: 'Proof of study (English)' },
    section: 'sealed',
    href: `${STUDENT}/tisk_dokumentu.pl?potvrzeni_tisk_el=1;jazyk=eng;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'prehled-sealed',
    label: { cs: 'Přehled studia', en: 'Study overview' },
    section: 'sealed',
    href: `${STUDENT}/tisk_dokumentu.pl?prehled_tisk_el=1;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'prehled-sealed-en',
    label: { cs: 'Přehled studia (anglicky)', en: 'Study overview (English)' },
    section: 'sealed',
    href: `${STUDENT}/tisk_dokumentu.pl?prehled_tisk_el=1;jazyk=eng;studium={{studium}};lang={{lang}}`,
  },

  // --- Tisk dokumentů (plain print, instant PDF) ---
  {
    id: 'potvrzeni',
    label: { cs: 'Potvrzení o studiu', en: 'Proof of study' },
    section: 'plain',
    href: `${STUDENT}/tisk_dokumentu.pl?potvrzeni_tisk=1;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'potvrzeni-en',
    label: { cs: 'Potvrzení o studiu (anglicky)', en: 'Proof of study (English)' },
    section: 'plain',
    href: `${STUDENT}/tisk_dokumentu.pl?potvrzeni_tisk=1;jazyk=eng;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'prehled',
    label: { cs: 'Přehled studia', en: 'Study overview' },
    section: 'plain',
    href: `${STUDIJNI}/V7_tisk.pl?v7_tisk=1;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'reg-arch',
    label: { cs: 'Registrační arch', en: 'Registration sheet' },
    section: 'plain',
    href: `${STUDENT}/tisk_dokumentu.pl?reg_arch_tisk=1;studium={{studium}};lang={{lang}}`,
  },
  {
    id: 'zadost',
    label: { cs: 'Žádost na studijní oddělení', en: 'Request to the study department' },
    section: 'plain',
    href: `${STUDENT}/zadost.pl?studium={{studium}};lang={{lang}}`,
  },
];

/** Resolve a document's href for the given student + UI language. */
export function buildDocumentUrl(doc: StudyDocument, studiumId: string, lang: 'cz' | 'en'): string {
  return injectUserParams(doc.href, studiumId, lang);
}
