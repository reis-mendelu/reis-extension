// mendelu_ledger (step 4b of the map, docs/superpowers/specs/2026-11-25-reis-for-claude-map-ledger.md):
// the list of dated things the student has to be somewhere for, kept by Claude. reIS extracts
// nothing and has no model: Claude reads a harmonogram or a brief and saves each date here;
// the overview then lists them with IS's own exam terms and deadlines. It asks IS nothing and
// writes only to reIS's own folder, so it works with no login. The tool's text is ledgerToolDef.ts.
import type { Store } from './store';
import { LedgerInputError, type LedgerEntry } from './ledgerEntry';
import { createLedger } from './storeLedger';
import {
  findListed,
  listedDate,
  readVersion,
  recheckReason,
  storedListings,
  type Listings,
} from './ledgerSource';
import { confirmNote, daysLeftOf, whenOf } from './ledgerUpcoming';

/** What one answer may carry of the 25,000 characters a result may have (format.ts). */
const BUDGET = 19_000;
const day = (now: Date) => now.toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' });

/** An entry as Claude reads it: what was saved, and what it means now. */
function shape(e: LedgerEntry, now: Date, listings: Listings) {
  const { start, end } = daysLeftOf(e, now);
  const recheck = recheckReason(e, listings);
  const confirm = confirmNote(e);
  const { savedAt: _s, updatedAt: _u, ...saved } = e;
  return {
    ...saved,
    when: whenOf(e),
    ...(end < 0 ? { status: 'past' } : { daysLeft: Math.max(0, start) }),
    ...(recheck ? { recheck } : {}),
    ...(confirm ? { confirm } : {}),
  };
}

/**
 * Fills in what Claude left out about the source file: its name from the listing, and the date
 * modified of the version it read (saved with its text), falling back to the listing's date
 * only when no text of it is saved. Never the listing first: a file replaced after Claude read
 * it would then look unchanged and never be marked recheck.
 */
async function withSource(store: Store, args: Record<string, unknown>) {
  const url = args.source_url;
  if (typeof url !== 'string' || !url) return args;
  const f = findListed(await storedListings(store), url);
  const read = args.source_modified ? undefined : await readVersion(store, url);
  return {
    ...args,
    source_modified: args.source_modified ?? read ?? (f ? listedDate(f) || undefined : undefined),
    source_file: args.source_file ?? (f ? f.file || f.name || undefined : undefined),
  };
}

export async function runLedger(
  store: Store,
  args: Record<string, unknown>,
  now: Date = new Date()
) {
  const ledger = createLedger(store, () => now.getTime());
  const today = day(now);
  try {
    switch (args.action) {
      case 'add': {
        // The forget token as the call begins: a forget while the source file is read cancels it.
        const asked = ledger.askedUnder();
        const { entry, created } = await ledger.add(await withSource(store, args), today, asked);
        return {
          saved: created
            ? 'added'
            : 'updated: this event was already saved, so it was not added twice',
          entry: shape(entry, now, {}),
        };
      }
      case 'update': {
        const asked = ledger.askedUnder();
        const sourced = await withSource(store, args);
        const entry = await ledger.update(String(args.id ?? ''), sourced, asked);
        return { saved: 'updated', entry: shape(entry, now, {}) };
      }
      case 'remove': {
        const had = await ledger.remove(String(args.id ?? ''));
        return { removed: had ? args.id : `nothing: no entry ${String(args.id)}` };
      }
      case 'list':
        return await list(store, ledger, args, now);
      default:
        throw new LedgerInputError('action must be list, add, update or remove.');
    }
  } catch (e) {
    // Said in the words of the input, so Claude can fix the call.
    if (e instanceof LedgerInputError) throw new Error(e.message);
    throw e;
  }
}

async function list(
  store: Store,
  ledger: ReturnType<typeof createLedger>,
  args: Record<string, unknown>,
  now: Date
) {
  const { entries, unreadable } = await ledger.list();
  const listings = await storedListings(store);
  const id = typeof args.id === 'string' ? args.id : '';
  const only = typeof args.subject === 'string' ? args.subject.trim().toUpperCase() : '';
  // An id asks for that one entry, past or not; otherwise the subject narrows the list.
  const inScope = entries.filter((e) => (id ? e.id === id : !only || e.code === only));
  const live = inScope.filter((e) => daysLeftOf(e, now).end >= 0);
  const matching = args.include_past === true || id ? inScope : live;
  const from = Math.min(Math.max(0, Math.trunc(Number(args.offset) || 0)), matching.length);
  const asked = Math.trunc(Number(args.limit) || 0);
  const page = matching.slice(from, asked > 0 ? from + asked : undefined);
  const rows = page.map((e) => shape(e, now, listings));
  // The whole answer goes into the student's chat and Claude's context: drop the last rows until it fits.
  let count = rows.length;
  while (count > 1 && JSON.stringify(rows.slice(0, count), null, 2).length > BUDGET) count--;
  const hidden = inScope.length - live.length;
  const next = from + count;
  return {
    count: matching.length,
    ...(next < matching.length
      ? {
          note: `Showing ${from + 1}-${next} of ${matching.length}. Pass offset ${next} for the next ones (subject narrows the list, id gives one entry).`,
        }
      : {}),
    ...(args.include_past !== true && !id && hidden > 0
      ? { pastHidden: `${hidden} past event(s) not shown: pass include_past to see them.` }
      : {}),
    ...(unreadable
      ? {
          unreadable: `${unreadable} saved file(s) in the ledger could not be read and are ignored.`,
        }
      : {}),
    entries: rows.slice(0, count),
  };
}
