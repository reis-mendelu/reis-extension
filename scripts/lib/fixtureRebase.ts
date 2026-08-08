/**
 * Project a date-relative dev fixture onto today's calendar.
 *
 * Exam data is seasonal: a snapshot scraped in July has no exam terms at all,
 * which leaves the Exams screen permanently in its empty state and unpolishable.
 * Committing absolute dates would rot within weeks, so fixtures author terms as
 * `dayOffset` from "now" and this module materialises the IS `DD.MM.YYYY` form
 * at serve time.
 *
 * Synthetic only — fixtures under `dev/fixtures/` contain no real student data.
 */

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** IS Mendelu's date format. */
export function formatIsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * The OTHER IS date format. Exam terms are `DD.MM.YYYY`; schedule lessons carry
 * a compact `YYYYMMDD`, and `buildDayAgenda` compares against it directly, so a
 * fixture lesson written in the term format simply never matches a day.
 */
export function formatCompactIsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function shift(now: Date, days: number): Date {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Offset authoring key → the absolute field it produces. */
const DATE_FIELDS: { offset: string; target: string; timeKey?: string }[] = [
  { offset: 'dayOffset', target: 'date' },
  { offset: 'regStartDayOffset', target: 'registrationStart' },
  { offset: 'regEndDayOffset', target: 'registrationEnd' },
  { offset: 'deregDayOffset', target: 'deregistrationDeadline', timeKey: 'deregTime' },
];

function rebaseTermLike(term: Json, now: Date): Json {
  const out: Json = { ...term };
  for (const { offset, target, timeKey } of DATE_FIELDS) {
    const raw = out[offset];
    if (typeof raw !== 'number') continue;
    const date = formatIsDate(shift(now, raw));
    const time = timeKey ? out[timeKey] : undefined;
    out[target] = typeof time === 'string' ? `${date} ${time}` : date;
    delete out[offset];
    if (timeKey) delete out[timeKey];
  }
  return out;
}

function rebaseSection(section: Json, now: Date): Json {
  const out: Json = { ...section };
  if (Array.isArray(out['terms'])) {
    out['terms'] = out['terms'].map((t) => (isObj(t) ? rebaseTermLike(t, now) : t));
  }
  if (isObj(out['registeredTerm'])) {
    out['registeredTerm'] = rebaseTermLike(out['registeredTerm'], now);
  }
  return out;
}

/**
 * Materialise every relative date in a fixture and stamp `lastSync` to now, so
 * the dev harness never mistakes a fixture for a stale scrape. Pure — the input
 * is not mutated.
 */
export function rebaseFixture(fixture: unknown, now: Date): Json {
  const src = isObj(fixture) ? fixture : {};
  const out: Json = { ...src };

  if (Array.isArray(out['exams'])) {
    out['exams'] = out['exams'].map((subject) => {
      if (!isObj(subject)) return subject;
      const s: Json = { ...subject };
      if (Array.isArray(s['sections'])) {
        s['sections'] = s['sections'].map((sec) => (isObj(sec) ? rebaseSection(sec, now) : sec));
      }
      return s;
    });
  }

  if (Array.isArray(out['schedule'])) {
    out['schedule'] = out['schedule'].map((lesson) => {
      if (!isObj(lesson)) return lesson;
      const raw = lesson['dayOffset'];
      if (typeof raw !== 'number') return lesson;
      const l: Json = { ...lesson, date: formatCompactIsDate(shift(now, raw)) };
      delete l['dayOffset'];
      return l;
    });
  }

  out['lastSync'] = now.getTime();
  return out;
}

/** Overlay a rebased fixture on whatever real snapshot exists (possibly none). */
export function applyFixture(base: Json, fixture: Json): Json {
  return { ...base, ...fixture };
}
