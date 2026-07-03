import { fetchWithAuth, BASE_URL } from './client';
import { logError } from '../utils/reportError';
import type { StudyComparison } from '../types/studyPlan';

export interface PercentileStanding {
  /** 'top' only for genuinely strong standing (top quartile), else 'bottom'. */
  tier: 'top' | 'bottom';
  /** Top tier: the percentile itself ("top X%"). Otherwise: the share you beat (100 - percentile). */
  pct: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Maps an IS "Percentil" value (rank/total*100, lower is better) to the
 * two-phase summary used in the E-index comparison. Only the top quartile
 * (percentile <= 25) gets the celebratory "top X%" framing — merely being
 * above the 50th percentile isn't an achievement worth a trophy. Everyone
 * else sees the more modest "beat X% of students" framing.
 */
export function percentileStanding(percentile: number): PercentileStanding {
  if (percentile <= 25) return { tier: 'top', pct: round2(percentile) };
  return { tier: 'bottom', pct: round2(100 - percentile) };
}

function parseNum(text: string): number {
  return parseFloat(text.replace(',', '.').replace(/\s/g, '')) || 0;
}

/**
 * Parses the "Srovnání studijních výsledků" (percentile) page. All three modes
 * ship in one page as #perc_3 / #perc_4 / #perc_5; we read Mode 3 (faculty +
 * study type + year) = #perc_5 — the fairest, most statistically robust cohort.
 */
export function parseStudyComparison(doc: Document): StudyComparison | null {
  const block = doc.querySelector('#perc_5');
  if (!block) return null;
  const row = block.querySelector('tr.lbn');
  if (!row) return null;
  const cells = row.querySelectorAll('td');
  if (cells.length < 4) return null;
  // Pořadí cell looks like "34./549" (rank ./ total).
  const m = (cells[0].textContent || '').match(/(\d+)\D+(\d+)/);
  if (!m) return null;
  return {
    rank: parseInt(m[1], 10),
    total: parseInt(m[2], 10),
    percentile: parseNum(cells[1].textContent || ''),
    gpa: parseNum(cells[2].textContent || ''),
    nextBetterGpa: parseNum(cells[3].textContent || ''),
  };
}

const PERCENTILE_URL = `${BASE_URL}/auth/student/pruchod_studiem.pl`;

export async function fetchStudyComparison(studium: string, obdobi: string): Promise<StudyComparison | null> {
  try {
    const res = await fetchWithAuth(`${PERCENTILE_URL}?vyber=zobrazeni_percentilu;studium=${studium};obdobi=${obdobi};lang=cz`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return parseStudyComparison(doc);
  } catch (e) {
    logError('Api.fetchStudyComparison', e);
    return null;
  }
}
