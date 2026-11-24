// Answers from IS kept in this process's memory, so Claude asking the same
// thing twice (a subagent rereading a PDF, a grader checking the brief again)
// does not ask IS twice. In 6 weeks of real use 71 of 73 same-session repeats
// got an identical answer. Memory only: nothing is written to disk and all of
// it is gone when the server stops (mcpStaysReadOnly.test.ts, PRIVACY.md).

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * How long each tool's answer stays good. Whatever a student can change by
 * acting in IS, or a teacher can change while they wait, stays a minute at
 * most: it only collapses a burst of identical calls.
 */
export const TTL_MS: Record<string, number> = {
  mendelu_assignments: MIN,
  mendelu_exams: MIN,
  mendelu_points: MIN,
  mendelu_grades: MIN,
  mendelu_subject_files: 5 * MIN,
  mendelu_schedule: 15 * MIN,
  // Also dropped early when its folder listing shows the file was modified.
  mendelu_read_file: HOUR,
  mendelu_subjects: HOUR,
  mendelu_study_plan: HOUR,
  mendelu_syllabus: 24 * HOUR,
  mendelu_success_rates: 24 * HOUR,
};

/** The plugin build hands over files of up to 10 MB whole; a few of them fit. */
const MAX_BYTES = 64 * 1024 * 1024;

type Entry = { value: unknown; at: number; bytes: number };
type Listed = { downloadUrl?: unknown; date?: unknown; modified?: unknown };

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, stable((v as Record<string, unknown>)[k])])
    );
  }
  return v;
}

/** The format only changes how a result is printed, not what IS said. */
function keyOf(tool: string, args: Record<string, unknown>): string {
  const { response_format: _format, ...rest } = args;
  return `${tool} ${JSON.stringify(stable(rest))}`;
}

export type ToolCache = ReturnType<typeof createToolCache>;

export function createToolCache({ now = Date.now, maxBytes = MAX_BYTES } = {}) {
  const entries = new Map<string, Entry>(); // insertion order = least recently used first
  const inflight = new Map<string, Promise<unknown>>();
  /** downloadUrl -> the Modifikace (or upload) date its folder last showed. */
  const fileStamps = new Map<string, string>();
  let total = 0;

  const drop = (key: string) => {
    const e = entries.get(key);
    if (!e) return;
    total -= e.bytes;
    entries.delete(key);
  };

  const keep = (key: string, value: unknown) => {
    const bytes = JSON.stringify(value)?.length ?? 0;
    if (bytes > maxBytes) return;
    drop(key);
    entries.set(key, { value, at: now(), bytes });
    total += bytes;
    for (const oldest of entries.keys()) {
      if (total <= maxBytes) break;
      drop(oldest);
    }
  };

  /** A replaced file keeps its download link; only the listing's date shows it. */
  const noteListing = (files: unknown) => {
    if (!Array.isArray(files)) return;
    for (const f of files as Listed[]) {
      if (typeof f?.downloadUrl !== 'string') continue;
      const stamp = String(f.modified ?? f.date ?? '');
      const seen = fileStamps.get(f.downloadUrl);
      if (seen !== undefined && seen !== stamp) {
        drop(keyOf('mendelu_read_file', { url: f.downloadUrl }));
      }
      fileStamps.set(f.downloadUrl, stamp);
    }
  };

  return {
    async run(tool: string, args: Record<string, unknown>, fetch: () => Promise<unknown>) {
      const ttl = TTL_MS[tool];
      if (!ttl) return fetch();
      const key = keyOf(tool, args);
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttl) {
        entries.delete(key); // move to the most recently used end
        entries.set(key, hit);
        return hit.value;
      }
      drop(key);
      const pending = inflight.get(key);
      if (pending) return pending;
      const p = fetch().then((value) => {
        if (tool === 'mendelu_subject_files') noteListing(value);
        keep(key, value);
        return value;
      });
      inflight.set(key, p);
      try {
        return await p;
      } finally {
        inflight.delete(key);
      }
    },
  };
}
