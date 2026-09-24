import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Which languages each fetcher asks IS for, read off the wire.
 *
 * reIS used to fetch every language-bearing page twice, cz and en, so the UI
 * could switch language without a refetch. Switching is rare and every sync
 * paid for it, so now a Czech student's fetches carry `lang=cz` and nothing
 * else. English students get `lang=en`, plus `lang=cz` where the English page
 * is not enough on its own:
 *
 *  - exams — `isGroupSignupSection` matches IS's Czech druh ("Zápis na …");
 *  - subjects — attendance is parsed off Czech `title` attributes;
 *  - study plan — IS does not translate the zaměření section, so the English
 *    plan borrows it from the Czech one (`borrowZameranisFromCz`).
 *
 * Read from the URL AND the POST body: the timetable sends `lang` in its body
 * and again inside `zpet`, so a URL-only check passes while wrong.
 */
const requests: string[] = [];
const fetchWithAuth = vi.fn();
vi.mock('../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));
vi.mock('../user', () => ({ getUserId: async () => 'u1' }));
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => ({ studium: 'st1', obdobi: 'ob1' }),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));

import { fetchDualLanguageSchedule } from '../schedule';
import { fetchDualLanguageExams } from '../exams';
import { fetchDualLanguageSubjects } from '../subjects';
import { fetchDualLanguageStudyPlan } from '../studyPlan';
import { fetchDualLanguagePastSubjects } from '../pastSubjects';
import { fetchOdevzdavarny } from '../odevzdavarny';
import { fetchCvicneTests } from '../cvicneTests';
import { fetchAndCacheSingleSyllabus } from '../../services/sync/syncSyllabus';

const RANGE = { start: new Date(2026, 8, 1), end: new Date(2027, 7, 31) };

/** Every `lang=` value on the wire, URL and body together. */
function languagesSent(): Set<string> {
  const seen = new Set<string>();
  for (const r of requests) for (const m of r.matchAll(/lang=(cz|en|cs)/g)) seen.add(m[1]!);
  return seen;
}

type Lang = 'cz' | 'en';
const FETCHERS: Record<string, (lang: Lang) => Promise<unknown>> = {
  timetable: (l) => fetchDualLanguageSchedule(RANGE, l),
  exams: (l) => fetchDualLanguageExams(l),
  subjects: (l) => fetchDualLanguageSubjects('st1', 'ob1', l),
  'study plan': (l) => fetchDualLanguageStudyPlan('st1', l),
  'past subjects': (l) => fetchDualLanguagePastSubjects(l),
  odevzdávárny: (l) => fetchOdevzdavarny('st1', 'ob1', l),
  'cvičné testy': (l) => fetchCvicneTests('st1', l),
  syllabus: (l) => fetchAndCacheSingleSyllabus('EBC-MAT', l, '123'),
};

/** What an English student's fetch must also ask in Czech, and why above. */
const NEEDS_CZECH_TOO = new Set(['exams', 'subjects', 'study plan']);

describe('each fetcher asks IS only for the language it needs', () => {
  beforeEach(() => {
    requests.length = 0;
    fetchWithAuth.mockReset();
    fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      requests.push(`${url} ${init?.body ? String(init.body) : ''}`);
      return new Response('<html><body>logout.pl</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    });
  });

  for (const [name, fetch] of Object.entries(FETCHERS)) {
    it(`${name}: a Czech student sends lang=cz only`, async () => {
      await fetch('cz');
      expect(requests.length, 'the fetcher made no request at all').toBeGreaterThan(0);
      expect([...languagesSent()]).toEqual(['cz']);
    });

    it(`${name}: an English student sends lang=en${NEEDS_CZECH_TOO.has(name) ? ' and lang=cz' : ' only'}`, async () => {
      await fetch('en');
      const expected = NEEDS_CZECH_TOO.has(name) ? ['cz', 'en'] : ['en'];
      expect([...languagesSent()].sort()).toEqual(expected);
    });
  }
});
