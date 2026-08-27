/* eslint-disable no-irregular-whitespace -- the literal NBSP in the two
   normalising regexes below is what IS Mendelu actually emits (&nbsp;) in the
   label and value cells. Suppressed rather than rewritten: CLAUDE.md forbids
   editing a parser to satisfy a lint rule. */
import { BASE_URL, fetchWithAuth } from './client';
import { isTermDetailPage } from './terminyInfo';
import { logError } from '../utils/reportError';

/**
 * Exam duration ("Délka trvání akce") lives only on the terminy_info.pl detail
 * page — the exam list (terminy_seznam.pl) has no such column. Before this
 * existed the weekly calendar assumed a flat 90 minutes for every exam, which
 * is wrong in both directions: a 10-minute oral exam and a 3-hour written one
 * both rendered as 1.5h blocks.
 */

// Sanity bounds. A parse landing outside these is far more likely to be a
// mis-read of unfamiliar markup than a real exam, and a bad value here becomes
// a multi-day calendar block — so we discard it and let the caller fall back.
const MIN_PLAUSIBLE_MINUTES = 1;
const MAX_PLAUSIBLE_MINUTES = 12 * 60;

/**
 * Convert an IS duration string to minutes.
 *
 * Verified format (real IS Mendelu sample, 2026-07): "10 minut".
 * The hour-length rendering has NOT been observed on a real page yet, so the
 * hour/combined/clock branches below are defensive. Anything unrecognised is
 * reported via telemetry rather than guessed at — that way real-world formats
 * surface as data instead of silently degrading to the 90-minute fallback.
 *
 * Returns null for IS empty sentinels, blanks, and unparseable input.
 */
export function parseDurationText(raw: string): number | null {
  const text = (raw ?? '').replace(/ /g, ' ').trim();

  if (!text) return null;
  if (text === '-- nezadáno --' || text === '-- not specified --') return null;

  const minutes = extractMinutes(text.toLowerCase());
  if (minutes === null) {
    logError('Parser.parseDurationText', new Error('unrecognised duration format'), { raw: text });
    return null;
  }

  if (minutes < MIN_PLAUSIBLE_MINUTES || minutes > MAX_PLAUSIBLE_MINUTES) return null;
  return minutes;
}

function extractMinutes(text: string): number | null {
  // "1:30" / "0:45" — clock-style.
  const clock = text.match(/^(\d{1,2}):([0-5]\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  // "1 hodina 30 minut", "2 hours", "10 minut" — sum every unit present.
  // Czech declensions (hodina/hodiny/hodin, minuta/minuty/minut) and the
  // English singular/plural both reduce to the hodin|hour / minut|minute stems.
  let total = 0;
  let matched = false;

  for (const m of text.matchAll(/(\d+)\s*(hodin\w*|hour\w*|minut\w*|minute\w*)/g)) {
    const value = Number(m[1]);
    const unit = m[2] ?? '';
    total += unit.startsWith('hodin') || unit.startsWith('hour') ? value * 60 : value;
    matched = true;
  }

  return matched ? total : null;
}

/**
 * Read "Délka trvání akce" from a terminy_info.pl detail page.
 *
 * Real markup (verified against an IS Mendelu sample, 2026-07):
 *   <td class="odsazena" nowrap="nowrap" align="left"><b>Délka trvání akce:</b></td>
 *   <td class="odsazena" align="left">10 minut</td>
 *
 * Same label-cell/value-cell shape as parseTermNotePage, so it anchors on the
 * <b> label rather than a column index. Matching the label exactly (not a
 * substring of the row) keeps a Poznámka like "Přijďte 10 minut předem" from
 * being read as the exam length.
 */
export function parseTermDurationPage(doc: Document): number | null {
  const labels = doc.querySelectorAll('td b');

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;
    const labelText = (label.textContent ?? '').replace(/ /g, ' ').trim();
    if (labelText !== 'Délka trvání akce:' && labelText !== 'Length of event:') continue;

    const valueCell = label.closest('td')?.nextElementSibling as Element | null;
    if (!valueCell) continue;

    return parseDurationText(valueCell.textContent ?? '');
  }

  return null;
}

/**
 * Fetch the scheduled length of a single exam term, in minutes.
 *
 * Throws when the page isn't a real detail page (session expired → login
 * redirect) so the caller knows not to treat the miss as "no duration set".
 * Returns null when the page loaded but the field is empty or unparseable.
 */
export async function fetchTermDuration(
  terminId: string,
  studiumId: string,
  obdobiId: string,
  lang: 'cz' | 'en' = 'cz'
): Promise<number | null> {
  const url = `${BASE_URL}/auth/student/terminy_info.pl?termin=${terminId};studium=${studiumId};obdobi=${obdobiId};lang=${lang}`;
  try {
    const res = await fetchWithAuth(url);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    if (!isTermDetailPage(doc)) {
      throw new Error('terminy_info.pl did not return a detail page (likely auth redirect)');
    }
    return parseTermDurationPage(doc);
  } catch (e) {
    logError('Api.fetchTermDuration', e, { terminId });
    throw e;
  }
}
