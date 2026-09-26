/** A teaching period. `ZS 2026` is "ZS 2026/2027"; `LS 2026` is "LS 2026/2027". */
export interface Period {
  term: 'ZS' | 'LS';
  startYear: number;
}

/**
 * September–January is ZS of Y/Y+1, February–August is LS of Y-1/Y.
 * From the date, never from IS's period list: IS lists the next semester first
 * every September (reis-scraper `currentPeriodLabel` learned this the hard way).
 */
export function currentPeriod(now: Date): Period {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 9) return { term: 'ZS', startYear: y };
  if (m === 1) return { term: 'ZS', startYear: y - 1 };
  return { term: 'LS', startYear: y - 1 };
}

export function periodLabel(p: Period): string {
  return `${p.term} ${p.startYear}/${p.startYear + 1}`;
}

/** The winter intake a year-`year` student started in (v1: winter intakes only). */
export function intakeLabel(year: number, now: Date): string {
  const p = currentPeriod(now);
  return periodLabel({ term: 'ZS', startYear: p.startYear - (year - 1) });
}

/** The plan semester a year-`year` student is in right now. */
export function targetSemester(year: number, now: Date): number {
  return currentPeriod(now).term === 'ZS' ? 2 * year - 1 : 2 * year;
}
