import { fetchWithAuth, BASE_URL } from './client';
import { logError } from '../utils/reportError';

const PROFILE_URL = `${BASE_URL}/auth/lide/clovek.pl`;

export interface PersonProfile {
  personId: number;
  name: string;
  universityEmail: string | null;
  privateEmail: string | null;
  programmeCode: string | null;
  programmeName: string | null;
  studyTypeSentence: string | null;
  yearSemesterSentence: string | null;
  /** Staff only: "Akademický pracovník - odborný asistent - Ústav informatiky (PEF)". */
  roles: string[];
  /** Estate code, e.g. "BA39N2056" — the campus map's room `code`. */
  officeCode: string | null;
  /** Friendly room name, e.g. "Q2.56" — the campus map's room `name`. */
  officeName: string | null;
  phone: string | null;
  workplace: string | null;
  consultationHours: string | null;
}

/**
 * Collapses IS's nbsp-laden whitespace so a value can be compared or shown.
 * `\s` already covers U+00A0, which is what IS's `&nbsp;` decodes to — no
 * separate pass for it.
 */
function tidy(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, ' ').trim() || null;
}

/**
 * The contact block is a two-column table: a label cell, then its value.
 * Blank spacer rows carry `colspan="2"` and are skipped by the length check.
 *
 * Read by label rather than by row index — IS omits any row the person has not
 * filled in, so positions shift from profile to profile.
 */
function readLabelledRows(doc: Document): Map<string, HTMLTableCellElement> {
  const out = new Map<string, HTMLTableCellElement>();
  for (const row of Array.from(doc.querySelectorAll('tr'))) {
    const cells = row.querySelectorAll<HTMLTableCellElement>('td.odsazena');
    if (cells.length !== 2) continue;
    const label = tidy(cells[0]?.textContent)?.replace(/:$/, '');
    const value = cells[1];
    if (label && value) out.set(label, value);
  }
  return out;
}

function deobfuscate(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.replace(/\s*\[at\]\s*/g, '@').trim() || null;
}

function findMatchInTds(doc: Document, marker: RegExp): string | null {
  const tds = Array.from(doc.querySelectorAll('td.odsazena'));
  for (const td of tds) {
    const text = (td.textContent ?? '').replace(/\s+/g, ' ').trim();
    const m = text.match(marker);
    if (m) return m[0].trim();
  }
  return null;
}

export function parsePersonProfile(html: string, personId: number): PersonProfile | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const nameEl = doc.querySelector('td.odsazena b font[size="+1"]');
  const name = nameEl?.textContent?.trim() ?? '';
  if (!name) return null;

  const univAnchor = doc.querySelector<HTMLAnchorElement>(
    `a[href*="nova_zprava.pl?uzivatel=${personId}"]`
  );
  const universityEmail = deobfuscate(univAnchor?.textContent);

  let privateEmail: string | null = null;
  const mailtoAnchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]'));
  if (mailtoAnchors.length > 0) {
    const href = mailtoAnchors[0].getAttribute('href') ?? '';
    privateEmail = href.replace(/^mailto:/, '').trim() || null;
  }

  let programmeCode: string | null = null;
  let programmeName: string | null = null;
  const boldTds = Array.from(doc.querySelectorAll('td.odsazena b'));
  for (const b of boldTds) {
    // eslint-disable-next-line no-irregular-whitespace
    const text = (b.textContent ?? '').replace(/ /g, ' ').trim();
    const m = text.match(/^([A-Z]\d{4}[A-Z]\d{6})\s+(.+)$/);
    if (m) {
      programmeCode = m[1];
      programmeName = m[2].trim();
      break;
    }
  }

  const studyTypeSentence = findMatchInTds(
    doc,
    /(Bakalářský|Magisterský|Navazující|Doktorský)[^,]*,\s*(prezenční|kombinovaná)\s*forma/i
  );

  const yearSemesterSentence = findMatchInTds(
    doc,
    /\d+\.\s*ročník\s*\/\s*\d+\.\s*semestr\s*studia/i
  );

  // Staff role lines sit in the HEADER table with no label column at all —
  // what marks them is the department anchor to pracoviste.pl. Read from the
  // anchor's own row so a department mentioned anywhere else is not mistaken
  // for a role.
  const roles = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="pracoviste.pl"]'))
    .map((a) => tidy(a.closest('td')?.textContent))
    .filter((line): line is string => Boolean(line));

  const labelled = readLabelledRows(doc);
  const phone = tidy(labelled.get('Telefon do zaměstnání')?.textContent);
  const workplace = tidy(labelled.get('Adresa pracoviště')?.textContent);
  const consultationHours = tidy(labelled.get('Konzultační hodiny')?.textContent);

  // The office cell holds both codes and they are not interchangeable: the
  // anchor TEXT is "BA39N2056 (Q2.56)" — estate code plus friendly name —
  // while the HREF carries only the friendly one as `placeName`. The campus
  // map's room index stores them as `code` and `name` respectively and will
  // match on either, so both are kept and the caller tries them in turn.
  const officeCell = labelled.get('Označení kanceláře');
  const officeText = tidy(officeCell?.textContent) ?? '';
  const officeCode = officeText.match(/^([A-Z0-9]+)/)?.[1] ?? null;
  const officeHref = officeCell?.querySelector('a')?.getAttribute('href') ?? '';
  const officeName =
    officeHref.match(/[?&]placeName=([^&]+)/)?.[1] ?? officeText.match(/\(([^)]+)\)/)?.[1] ?? null;

  return {
    personId,
    name,
    universityEmail,
    privateEmail,
    programmeCode,
    programmeName,
    studyTypeSentence,
    yearSemesterSentence,
    roles,
    officeCode,
    officeName: officeName ? decodeURIComponent(officeName) : null,
    phone,
    workplace,
    consultationHours,
  };
}

export async function fetchPersonProfile(personId: number): Promise<PersonProfile | null> {
  const url = `${PROFILE_URL}?id=${personId};lang=cz`;
  try {
    const response = await fetchWithAuth(url);
    const html = await response.text();
    const result = parsePersonProfile(html, personId);
    if (!result) {
      logError('Parser.parsePersonProfile', new Error('clovek.pl returned no name'), { personId });
    }
    return result;
  } catch (e) {
    logError('Api.fetchPersonProfile', e, { personId });
    throw e;
  }
}
