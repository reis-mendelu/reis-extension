import { fetchTermDuration } from '../../api/termDuration';
import { logError } from '../../utils/reportError';
import type { ExamSubject } from '../../types/exams';

/**
 * Attach "Délka trvání akce" to every exam term the student can see.
 *
 * Runs in the content script (the only context with IS cookies) right after the
 * exam list syncs. The weekly calendar sizes an exam block from the registered
 * term's length; the phone shows every term's length under it.
 *
 * Registered terms are fetched first, so a sync that runs out of budget spends
 * it on the calendar's blocks before anything else. A length never changes
 * once IS publishes it and is never refetched, so after the first sync only
 * newly listed terms cost a request.
 *
 * A listed term whose page has no length is remembered as `null` and not asked
 * again either — otherwise every such term cost a request on every sync. Only
 * a registered term with none is asked again: the calendar sizes its block,
 * a teacher can still fill the length in, and there are a handful of them.
 */

// IS Mendelu sees a burst of parallel detail-page hits as unfriendly; the
// on-demand Poznámka path in createExamSlice caps itself the same way.
const MAX_CONCURRENT = 3;

// syncAllData awaits this call before it assembles the end-of-phase batch and
// reports the run finished, and fetchWithAuth carries no timeout of its own —
// so one stalled terminy_info.pl request would leave the app syncing forever
// (and, on mobile, never latch firstSyncSettled). Bound the whole enrichment
// instead of each request: every term that did not answer in time simply keeps
// no duration, which is the same fallback a failed fetch already takes.
export const ENRICHMENT_BUDGET_MS = 20000;

/** termId → durationMinutes for every term already carrying one; null = IS had none. */
function cachedDurations(exams: ExamSubject[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const subject of exams) {
    for (const section of subject.sections) {
      const term = section.registeredTerm;
      if (term?.id && typeof term.durationMinutes === 'number') {
        map.set(term.id, term.durationMinutes);
      }
      for (const listed of section.terms) {
        if (listed.id && listed.durationMinutes !== undefined) {
          map.set(listed.id, listed.durationMinutes);
        }
      }
    }
  }
  return map;
}

/** Runs `tasks` MAX_CONCURRENT at a time; none starts once `stopped()` says so. */
async function runCapped(tasks: (() => Promise<void>)[], stopped: () => boolean): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, async () => {
    while (!stopped() && cursor < tasks.length) {
      const task = tasks[cursor++];
      if (task) await task();
    }
  });
  await Promise.all(workers);
}

/**
 * Returns a copy of `exams` with `durationMinutes` populated on every term
 * (and on `registeredTerm`).
 *
 * A duration is static once IS publishes it, so any value already present in
 * `cachedExams` is reused and never refetched — no TTL bookkeeping needed, and
 * a term that failed last time is simply retried on the next sync.
 *
 * Never throws: a per-term failure (expired session, DOM drift) leaves that
 * term without a duration, and the calendar falls back to its 90-minute
 * default. Sync must not fail because an exam length could not be read.
 */
export async function enrichExamsWithDurations(
  exams: ExamSubject[],
  cachedExams: ExamSubject[],
  studiumId: string,
  obdobiId: string
): Promise<ExamSubject[]> {
  if (!studiumId || !obdobiId) return exams;

  const known = cachedDurations(cachedExams);
  const resolved = new Map<string, number | null>(known);
  const pending: string[] = [];

  const queue = (id: string | undefined, askAgainIfNone = false) => {
    if (!id || pending.includes(id)) return;
    if (resolved.has(id) && !(askAgainIfNone && resolved.get(id) === null)) return;
    pending.push(id);
  };
  // Registered terms first — see the doc comment.
  for (const subject of exams) {
    for (const section of subject.sections) {
      if (section.status === 'registered') queue(section.registeredTerm?.id, true);
    }
  }
  for (const subject of exams) {
    for (const section of subject.sections) {
      for (const listed of section.terms) queue(listed.id);
    }
  }

  let expired: ReturnType<typeof setTimeout> | undefined;
  // Set once the budget wins: losing the race does not cancel the workers, and
  // left running they kept pulling terms off the queue into the next sync.
  let outOfBudget = false;
  await Promise.race([
    runCapped(
      pending.map((terminId) => async () => {
        try {
          // null is an answer — the page loaded and has no length. A throw
          // (expired session) is not, and leaves the term to the next sync.
          resolved.set(terminId, await fetchTermDuration(terminId, studiumId, obdobiId));
        } catch (e) {
          logError('Sync.enrichExamsWithDurations', e, { terminId });
        }
      }),
      () => outOfBudget
    ),
    new Promise<void>((resolve) => {
      expired = setTimeout(resolve, ENRICHMENT_BUDGET_MS);
    }),
  ]);
  // Whichever side won, stop holding a timer open — a pending one keeps the
  // content script's event loop alive for the full budget on every sync.
  clearTimeout(expired);
  outOfBudget = true;

  return exams.map((subject) => ({
    ...subject,
    sections: subject.sections.map((section) => {
      const term = section.registeredTerm;
      const regMinutes = term?.id ? resolved.get(term.id) : undefined;
      return {
        ...section,
        // The calendar's block takes a number or its 90-minute default.
        registeredTerm:
          term && typeof regMinutes === 'number' ? { ...term, durationMinutes: regMinutes } : term,
        terms: section.terms.map((listed) => {
          const minutes = resolved.get(listed.id);
          return minutes === undefined ? listed : { ...listed, durationMinutes: minutes };
        }),
      };
    }),
  }));
}
