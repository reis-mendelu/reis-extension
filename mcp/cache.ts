// Answers from IS kept in this process's memory, so Claude asking the same
// thing twice (a subagent rereading a PDF, a grader checking the brief again)
// does not ask IS twice. In 6 weeks of real use 71 of 73 same-session repeats
// got an identical answer. This memory is the first tier and is gone when the
// server stops. The second tier is the store on disk (storeMap.ts): a file's
// text it holds is served again after a restart while the folder listing still
// shows the date it was read at; everything else goes back to IS, and what IS
// answers is saved there. The tiers never hold the password or the IS
// sign-in (mcpStaysReadOnly.test.ts, README.md, PRIVACY.md).

const MIN = 60_000;
const HOUR = 60 * MIN;
const READ = 'mendelu_read_file';
const LIST = 'mendelu_subject_files';

/**
 * How long each tool's answer stays good; 0 is never kept here. Whatever a
 * student can change by acting in IS, or a teacher can change while they wait,
 * stays a minute at most: it only collapses a burst of identical calls.
 */
export const TTL_MS: Record<string, number> = {
  mendelu_assignments: MIN,
  mendelu_exams: MIN,
  mendelu_points: MIN,
  mendelu_grades: MIN,
  [LIST]: 5 * MIN,
  mendelu_schedule: 15 * MIN,
  // Also dropped as soon as its folder listing shows another date for the file.
  [READ]: HOUR,
  mendelu_subjects: HOUR,
  mendelu_study_plan: HOUR,
  mendelu_syllabus: 24 * HOUR,
  // fetchSubjectSuccessRates keeps what it fetched itself and asks again for a
  // subject whose request failed; an answer kept here would hide that retry.
  mendelu_success_rates: 0,
};

/** The plugin build hands over files of up to 10 MB whole; a few of them fit. */
const MAX_BYTES = 64 * 1024 * 1024;

/**
 * The second tier (storeMap.ts). `load` runs on a memory miss, before IS is
 * asked, and returns an answer the disk can vouch for or undefined; `stamp` is
 * the listing date known now (a file read only; undefined before any listing).
 * `save` gets what IS answered. Neither may throw into a tool.
 */
export type Persist = {
  /** Taken when a request starts, handed back to save(): a forget() in between cancels the save. */
  begin(): Promise<unknown>;
  load(tool: string, args: Record<string, unknown>, stamp: string | undefined): Promise<unknown>;
  save(
    tool: string,
    args: Record<string, unknown>,
    value: unknown,
    stamp: string | undefined,
    token?: unknown
  ): Promise<void>;
};

/** `stamp`: for a file read, the listing date known when the download started. */
type Entry = { value: unknown; at: number; bytes: number; stamp?: string };
type Pending = { promise: Promise<unknown>; stamp?: string };
type Listed = { downloadUrl?: unknown; date?: unknown; modified?: unknown };

/**
 * What a listing shows for a file. Says which column it came from: only IS's
 * Modifikace changes when a teacher replaces a file, the document date does not
 * (storeMap.ts trusts nothing else).
 */
const stampOf = (f: Listed) =>
  f.modified ? `modified ${String(f.modified)}` : `date ${String(f.date ?? '')}`;

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

export function createToolCache({
  now = Date.now,
  maxBytes = MAX_BYTES,
  persist,
}: { now?: () => number; maxBytes?: number; persist?: Persist } = {}) {
  const entries = new Map<string, Entry>(); // insertion order = least recently used first
  const inflight = new Map<string, Pending>();
  /** downloadUrl -> the Modifikace (or upload) date its folder last showed. */
  const fileStamps = new Map<string, string>();
  let total = 0;

  const drop = (key: string) => {
    const e = entries.get(key);
    if (!e) return;
    total -= e.bytes;
    entries.delete(key);
  };

  const keep = (key: string, value: unknown, stamp?: string) => {
    // A JS string holds up to 2 bytes a character (Czech text does), key included.
    const bytes = 2 * (key.length + (JSON.stringify(value)?.length ?? 0));
    if (bytes > maxBytes) return;
    drop(key);
    entries.set(key, { value, at: now(), bytes, stamp });
    total += bytes;
    for (const oldest of entries.keys()) {
      if (total <= maxBytes) break;
      drop(oldest);
    }
  };

  /**
   * A replaced file keeps its download link; only the listing's date shows it.
   * A read made against any other date (or before any listing) is dropped, and
   * one still downloading is cut loose so it is neither joined nor kept.
   */
  const noteListing = (files: unknown) => {
    if (!Array.isArray(files)) return;
    for (const f of files as Listed[]) {
      if (typeof f?.downloadUrl !== 'string') continue;
      const stamp = stampOf(f);
      fileStamps.set(f.downloadUrl, stamp);
      const key = keyOf(READ, { url: f.downloadUrl });
      if (entries.has(key) && entries.get(key)!.stamp !== stamp) drop(key);
      if (inflight.has(key) && inflight.get(key)!.stamp !== stamp) inflight.delete(key);
    }
  };

  return {
    /** Forget everything held here, including reads still in flight (forget everything). */
    clear() {
      entries.clear();
      inflight.clear();
      fileStamps.clear();
      total = 0;
    },
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
      if (pending) return pending.promise;
      const mine: Pending = {
        promise: Promise.resolve(),
        stamp: tool === READ ? fileStamps.get(String(args.url)) : undefined,
      };
      // fetch() starts at once when there is no second tier, as it always did.
      const fromFetch = () => fetch().then((value) => ({ value, stored: false }));
      const token = persist?.begin().catch(() => null);
      const obtained = persist
        ? persist
            .load(tool, args, mine.stamp)
            .catch(() => undefined)
            .then((value) => (value !== undefined ? { value, stored: true } : fromFetch()))
        : fromFetch();
      mine.promise = obtained.then(async ({ value, stored }) => {
        if (tool === LIST) noteListing(value);
        // Cut loose by a newer listing or by clear(): hand it to its caller,
        // keep and save nothing.
        const current = inflight.get(key) === mine;
        if (current) keep(key, value, mine.stamp);
        if (current && !stored) {
          await persist?.save(tool, args, value, mine.stamp, await token).catch(() => {});
        }
        return value;
      });
      inflight.set(key, mine);
      try {
        return await mine.promise;
      } finally {
        if (inflight.get(key) === mine) inflight.delete(key);
      }
    },
  };
}
