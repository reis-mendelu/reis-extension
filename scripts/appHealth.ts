/**
 * Decides whether a built reIS web bundle is healthy, from observations a
 * browser collected.
 *
 * Split from the Playwright driver on purpose: every rule below is a judgement
 * that can be got wrong, and a judgement in a browser callback is a judgement
 * nobody tests. The driver's only job is to gather facts.
 *
 * The rules are the checks that were being reassembled by hand on 2026-09-04,
 * once per verification, while six real defects went unnoticed between runs:
 * a build that rendered skeletons forever, a page writing to production
 * Supabase, a real student record copied into the output, and three guards
 * that were dead in a production build.
 */

/** Hosts and paths the built preview must never touch. */
const FORBIDDEN_REQUEST_PATTERNS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /is\.mendelu\.cz/,
    why: 'the preview has no IS session, so this can only ever be a CORS failure — and on a hosted page it means the university is being called on every visit',
  },
  {
    pattern: /\/rpc\/track_daily_usage/,
    why: 'inflates the real install metric with preview traffic, bots included',
  },
  {
    pattern: /\/rpc\/submit_suggestion/,
    why: 'files preview noise as genuine student feedback',
  },
  {
    pattern: /\/rpc\/submit_feedback/,
    why: 'files preview noise as genuine student feedback',
  },
  {
    pattern: /\/rpc\/set_event_rsvp/,
    why: 'writes a society RSVP from a build nobody is really attending from',
  },
  {
    pattern: /dev-real-data\.json/,
    why: 'that is the RAW scrape — the deployed build must only ever read the sanitised preview-data.json',
  },
];

export interface HealthObservations {
  /** Every network request URL the page made, in order. */
  requests: string[];
  /** Row counts per IndexedDB store, after the app settled. */
  storeCounts: Record<string, number>;
  /** Elements still carrying DaisyUI's `skeleton` class after settling. */
  skeletonCount: number;
  /** Visible text length, as a crude "did anything render at all" signal. */
  textLength: number;
  /** Files present in the built output directory. */
  outputFiles: string[];
  /** Which data the build was meant to be showing. */
  mode: 'demo' | 'real';
}

export interface HealthFailure {
  check: string;
  detail: string;
}

/**
 * Stores that must hold at least one row, per mode.
 *
 * `demo` is deliberately short: the synthetic dataset fills only what
 * MockManager writes, and asserting more would fail for a reason that is not a
 * defect. `real` is the fuller set, which is the whole point of real data.
 */
const REQUIRED_STORES: Record<'demo' | 'real', string[]> = {
  demo: ['schedule'],
  real: ['schedule', 'subjects', 'study_plan', 'files', 'syllabuses'],
};

export function evaluateHealth(o: HealthObservations): {
  ok: boolean;
  failures: HealthFailure[];
} {
  const failures: HealthFailure[] = [];

  for (const { pattern, why } of FORBIDDEN_REQUEST_PATTERNS) {
    const hits = o.requests.filter((u) => pattern.test(u));
    if (hits.length > 0) {
      failures.push({
        check: 'forbidden request',
        detail: `${hits.length} request(s) matching ${pattern} — ${why}`,
      });
    }
  }

  if (o.outputFiles.includes('dev-real-data.json')) {
    failures.push({
      check: 'raw scrape in output',
      detail:
        'dev-real-data.json is present in the build output. It is a real student record and must be stripped unconditionally.',
    });
  }

  // The failure that motivated this whole script: the app booted, fetched its
  // data, and sat on skeletons forever because nothing was listening. It looked
  // like a slow page rather than a broken one.
  if (o.skeletonCount > 0) {
    failures.push({
      check: 'stuck on skeletons',
      detail: `${o.skeletonCount} element(s) still carry the DaisyUI \`skeleton\` class after the app settled — the data never arrived.`,
    });
  }

  for (const store of REQUIRED_STORES[o.mode]) {
    const count = o.storeCounts[store];
    if (count === undefined) {
      failures.push({
        check: 'store missing',
        detail: `IndexedDB has no \`${store}\` store at all.`,
      });
    } else if (count === 0) {
      failures.push({
        check: 'store empty',
        detail: `\`${store}\` is empty; in ${o.mode} mode it should hold at least one row.`,
      });
    }
  }

  // A blank page passes every check above, because nothing rendered to be
  // wrong. The threshold is deliberately low: a legitimate screen can be
  // short — the calendar on a day with no lessons renders about 190
  // characters, all of it correct — so this only catches a page that did not
  // render at all, not one that rendered little.
  if (o.textLength < 80) {
    failures.push({
      check: 'nothing rendered',
      detail: `The page has only ${o.textLength} characters of visible text — it did not render.`,
    });
  }

  return { ok: failures.length === 0, failures };
}

/** Human-readable summary for the CLI and for a CI log. */
export function formatHealthReport(
  result: { ok: boolean; failures: HealthFailure[] },
  mode: string
): string {
  if (result.ok) return `✓ app health OK (${mode} data)`;
  const lines = [`✗ app health FAILED (${mode} data) — ${result.failures.length} problem(s):`, ''];
  for (const f of result.failures) lines.push(`  [${f.check}] ${f.detail}`);
  return lines.join('\n');
}
