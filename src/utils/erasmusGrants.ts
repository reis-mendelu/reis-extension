import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import type { ErasmusConfig } from '@/types/erasmus';

export function getGrantForCountryId(config: ErasmusConfig, countryId: string): number | null {
  const country = ERASMUS_COUNTRIES.find(c => c.id === countryId);
  if (!country) return null;
  const group = config.grants.find(g => g.countries.includes(country.alpha2));
  return group?.eur ?? null;
}

type DeadlineStatus =
  | { status: 'closed' }
  | { status: 'open'; daysLeft: number }
  | { status: 'closingSoon'; daysLeft: number }
  | { status: 'announced'; date: string };

export function getDeadlineStatus(config: ErasmusConfig): DeadlineStatus {
  const now = Date.now();
  const open = new Date(config.deadlines.applicationOpen).getTime();
  const close = new Date(config.deadlines.applicationClose).getTime();
  const results = new Date(config.deadlines.resultsAnnounced).getTime();

  if (now < open) return { status: 'closed' };
  if (now >= open && now <= close) {
    const daysLeft = Math.ceil((close - now) / (1000 * 60 * 60 * 24));
    return daysLeft <= 14 ? { status: 'closingSoon', daysLeft } : { status: 'open', daysLeft };
  }
  if (now > close && now <= results) {
    return { status: 'announced', date: config.deadlines.resultsAnnounced };
  }
  return { status: 'closed' };
}
