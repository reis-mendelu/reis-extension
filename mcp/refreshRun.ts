// mendelu_refresh (step 6 of the map, decision 5 of docs/superpowers/specs/2026-11-25-reis-for-
// claude-map-design.md): the one call the student's scheduled digest routine makes. The same cheap
// look and diff as the overview (overviewLook.ts), against the refresh's own record, then the new
// or replaced files of subjects the map already knows are downloaded within the byte budget
// (buildDownload.ts). It reports; it never writes to IS, a calendar or a mailbox.
import type { Store } from './store';
import type { Run } from './overviewGather';
import { RECORD } from './overviewTool';
import { look, readRecord, recordLook } from './overviewLook';
import { own } from './overviewRecord';
import type { Change } from './overviewDiff';
import { stampOf } from './cache';
import { createOriginals } from './storeOriginals';
import { downloadPlanned, type DownloadDeps, type Stop } from './buildDownload';
import type { Outcome, Planned } from './buildReport';
import type { SubjectFile } from './files';
import { recheckReason } from './ledgerSource';
import { whenOf } from './ledgerUpcoming';
import { upcomingItems } from './overviewUpcoming';
import { fitRefresh, type FileRow } from './refreshReport';
import { holdUnreported } from './refreshHold';

/** What the last refresh saw. Its own record: what the overview showed at noon is still in the digest. */
export const REFRESH_RECORD = 'refresh/seen.json';

export type RefreshDeps = Omit<DownloadDeps, 'token'> & {
  /** cache.run bound to this call's ticket, fresh: a listing served from memory would hide a change. */
  run: Run;
  token: unknown;
  /** Resolves once the study profile a call started has been written. */
  settled: () => Promise<unknown>;
  format: 'markdown' | 'json';
  now?: Date;
};

const queues = new WeakMap<Store, Promise<unknown>>();

/** One refresh at a time per store in this process, like the overview: no change reported twice. */
export function runRefresh(d: RefreshDeps) {
  const prior = queues.get(d.store) ?? Promise.resolve();
  const run = prior.then(
    () => refresh(d),
    () => refresh(d)
  );
  queues.set(
    d.store,
    run.catch(() => {})
  );
  return run;
}

const tokenOf = (t: unknown) =>
  t && typeof t === 'object' && 'gen' in t && 'at' in t
    ? (t as { gen: string | null; at: number })
    : null;

/** A file that could not be kept for a reason that can pass (network, budget, a forget) is tried again. */
const retry = (o: Outcome | undefined) =>
  !!o &&
  (o.state === 'failed' || (o.state === 'skipped' && !/^skipped: over \d+ MB/.test(o.reason)));

function outcomeText(o: Outcome | undefined, known: boolean): string {
  if (!known)
    return 'not downloaded: this subject had no listing before; mendelu_build_my_map saves its files';
  if (!o || o.state === 'kept') return 'already saved';
  if (o.state === 'downloaded') return 'downloaded';
  return o.state === 'failed' ? `failed: ${o.reason}` : o.reason;
}

async function refresh(d: RefreshDeps) {
  const now = d.now ?? new Date();
  const { prev, borrowed } = await readRecord(d.store, REFRESH_RECORD, RECORD);
  const { g, ledger, changes } = await look(d.store, d.run, d.ctx, now, prev);
  await d.settled();

  const listed = new Map<string, SubjectFile>();
  for (const l of Object.values(g.listings)) for (const f of l ?? []) listed.set(f.downloadUrl, f);
  const originals = createOriginals(d.store);
  const planned: Planned[] = [];
  const plannedFor = new Map<Change, Planned>();
  const known = (c: Change) => !!prev && own(prev.files, c.code);
  for (const c of changes) {
    if (c.kind !== 'file' || !c.url || (c.what !== 'new' && c.what !== 'replaced')) continue;
    const f = listed.get(c.url);
    // Only subjects whose files were listed before: a refresh never downloads a whole library.
    if (!f || !known(c)) continue;
    const stamp = stampOf(f);
    const p = { code: c.code, file: f, stamp, kept: !!(await originals.kept(c.url, stamp)) };
    planned.push(p);
    plannedFor.set(c, p);
  }

  let outcomes = new Map<Planned, Outcome>();
  let stop: Stop;
  let budget = { max: d.store.maxBytes, used: (await d.store.usage()).bytes };
  if (planned.some((p) => !p.kept)) {
    if (!d.store.persistent) {
      stop = 'folder';
      for (const p of planned)
        if (!p.kept)
          outcomes.set(p, { state: 'skipped', reason: 'skipped: reIS cannot save to its folder' });
    } else {
      ({ outcomes, budget, stop } = await downloadPlanned(
        { ...d, token: tokenOf(d.token) },
        planned
      ));
    }
  }

  const rows: { change: Change; row: FileRow }[] = [];
  for (const c of changes) {
    if (c.kind !== 'file') continue;
    const f = c.url ? listed.get(c.url) : undefined;
    const was = c.was ? prev?.files[c.code]?.[c.was] : undefined;
    const p = plannedFor.get(c);
    rows.push({
      change: c,
      row: {
        code: c.code,
        file: f ? f.file || f.name : (was?.n ?? ''),
        what: c.what ?? 'new',
        ...(f ? { modified: f.modified || f.date || '' } : {}),
        ...(c.url ? { url: c.url } : {}),
        ...(c.what === 'gone' ? {} : { outcome: outcomeText(p && outcomes.get(p), !!p) }),
      },
    });
  }
  const recheck = ledger.flatMap((e) => {
    const reason = recheckReason(e, g.listings);
    return reason
      ? [{ id: e.id, code: e.code ?? '', title: e.title, when: whenOf(e), reason }]
      : [];
  });
  const upcoming = upcomingItems(
    g.boxes,
    g.exams,
    now,
    { entries: ledger, listings: g.listings },
    500
  );

  const { out, held } = fitRefresh({
    first: !prev,
    borrowed,
    since: (prev as { refreshedAt?: unknown } | null)?.refreshedAt,
    changes,
    rows,
    counts: {
      downloaded: [...outcomes.values()].filter((o) => o.state === 'downloaded').length,
      alreadySaved: planned.filter((p) => p.kept).length,
      skipped: [...outcomes.values()].filter((o) => o.state === 'skipped').length,
      failed: [...outcomes.values()].filter((o) => o.state === 'failed').length,
    },
    stop,
    budget,
    recheck,
    upcoming: upcoming.items,
    problems: g.problems,
    folder: d.store.dir,
    format: d.format,
  });
  // A file not kept for a passing reason is not recorded: the next refresh reports and tries it again.
  const again = [...plannedFor].filter(([, p]) => retry(outcomes.get(p))).map(([c]) => c);
  // Points rows, boxes and exam terms the answer left out are kept as they were, so they come next time.
  const saved = await recordLook(
    d.store,
    REFRESH_RECORD,
    prev,
    g.world,
    [...held, ...again],
    d.token,
    {
      extra: { refreshedAt: now.toISOString() },
      patch: (next) => holdUnreported(next, prev, held),
    }
  );
  if (saved) return out;
  return {
    ...out,
    checkpoint:
      'reIS could not save what this refresh reported, so the next refresh may report these changes again (or, on a first refresh, take the baseline again).',
  };
}
