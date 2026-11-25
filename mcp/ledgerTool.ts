// mendelu_ledger (step 4b of the map, docs/superpowers/specs/2026-11-25-reis-for-claude-map-ledger.md):
// the list of dated things the student has to be somewhere for, kept by Claude. reIS extracts
// nothing and has no model: Claude reads a harmonogram or a brief and saves each date here;
// the overview then lists them with IS's own exam terms and deadlines. It asks IS nothing and
// writes only to reIS's own folder, so it works with no login.
import { z } from 'zod';
import type { Store } from './store';
import { KINDS, LedgerInputError, SOURCES, type LedgerEntry } from './ledgerEntry';
import { createLedger } from './storeLedger';
import {
  findListed,
  listedDate,
  recheckReason,
  storedListings,
  type Listings,
} from './ledgerSource';
import { confirmNote, daysLeftOf, whenOf } from './ledgerUpcoming';

export const LEDGER_TOOL = {
  name: 'mendelu_ledger',
  title: "The student's list of upcoming tests, defences and events",
  description:
    'The list of dated things the student has to be somewhere for: tests, credit tests, project defences, resits, programme days, events, unregistration deadlines. YOU keep it; reIS only stores it and shows it in the "upcoming" part of mendelu_overview, soonest first, with days left. ' +
    'WHEN TO USE: after you read a harmonogram, passing conditions, a project brief, a mail or anything else that names a date the student must act on or attend, SAVE EVERY dated event you found with action "add", one call per event, before you answer. Do not leave it only in your reply: the next conversation starts from the overview and finds it there. Also add an event the student tells you about. ' +
    'DO NOT add what reIS already shows: registered exam terms and open assignment deadlines come from IS by themselves. ' +
    'FIELDS: title (what, short), kind, date YYYY-MM-DD (Prague time), time HH:MM when the file gives one; for a stretch of days (a programme week, "in the 12th week") pass `until` as the last day. code = subject code. room, length_minutes, points, rule (minimum points, no aids), unregister_by (the last day to unregister), depends_on (what needs it, e.g. a programme that needs this test passed). source_kind says where it came from: is, course_file, mail, calendar or student. For a course_file ALWAYS pass source_url (the file\'s `url` from the overview) and source_modified (its `modified`) and source_file (its name): that is how reIS notices the file was replaced later and marks the entry "recheck". ' +
    'STATED OR INFERRED: basis "stated" when the file names the date. When you worked it out (the "12th week" is 14-18 December), pass basis "inferred" and inferred_how; the overview then tells the student to confirm it with the teacher. Never present an inferred date as certain. ' +
    'OTHER ACTIONS: "list" shows the saved events (past ones only with include_past, and a replaced source file shows as recheck); "update" changes the fields you pass for an id (an empty string clears one; pass source_modified to say you rechecked the file); "remove" deletes one. Adding the same event twice updates it, it does not duplicate. It changes nothing in IS and nothing in the student\'s calendar.',
  input: {
    action: z.enum(['list', 'add', 'update', 'remove']).describe('What to do.'),
    id: z
      .string()
      .max(20)
      .optional()
      .describe('update, remove: the event id (ev-…) from list or add.'),
    title: z
      .string()
      .max(120)
      .optional()
      .describe('add: what it is, short, e.g. "Zápočtový test 1".'),
    kind: z.enum(KINDS).optional().describe('add: the kind of event.'),
    code: z
      .string()
      .max(30)
      .optional()
      .describe('Subject code, e.g. EBC-PE. Leave out for an event without a subject.'),
    date: z
      .string()
      .max(10)
      .optional()
      .describe('YYYY-MM-DD, Prague time. The first day when `until` is given.'),
    time: z
      .string()
      .max(5)
      .optional()
      .describe('HH:MM, 24-hour, only when the source gives a time.'),
    until: z
      .string()
      .max(10)
      .optional()
      .describe('YYYY-MM-DD: the last day, for a window of days (at most 60).'),
    length_minutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional()
      .describe('How long it lasts, in minutes.'),
    room: z.string().max(60).optional(),
    points: z
      .string()
      .max(40)
      .optional()
      .describe('Points it is worth, as the source states them.'),
    rule: z
      .string()
      .max(500)
      .optional()
      .describe('The rule that matters: minimum points, no aids, bring a laptop.'),
    unregister_by: z
      .string()
      .max(16)
      .optional()
      .describe('Last day to unregister: YYYY-MM-DD or YYYY-MM-DD HH:MM.'),
    depends_on: z
      .string()
      .max(300)
      .optional()
      .describe('What depends on this, when the source says.'),
    attendance: z
      .boolean()
      .optional()
      .describe(
        'Whether the student must be there in person. Default: yes for tests, defences and programme days.'
      ),
    source_kind: z.enum(SOURCES).optional().describe('add: where the date came from.'),
    source_file: z.string().max(200).optional().describe("The file's name."),
    source_url: z
      .string()
      .max(600)
      .optional()
      .describe("A course file's `url` from the overview (so a replaced file is noticed)."),
    source_modified: z
      .string()
      .max(40)
      .optional()
      .describe("The file's `modified` date from the overview, as it was when you read it."),
    basis: z
      .enum(['stated', 'inferred'])
      .optional()
      .describe('Default stated. "inferred" needs inferred_how.'),
    inferred_how: z.string().max(300).optional().describe('How an inferred date was worked out.'),
    subject: z.string().max(30).optional().describe('list: only this subject code.'),
    include_past: z.boolean().optional().describe('list: also events already past.'),
  },
} as const;

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

/** Fills in what the listing already knows about the source file, so Claude need not copy it. */
function withSource(args: Record<string, unknown>, listings: Listings) {
  const url = args.source_url;
  if (typeof url !== 'string' || !url) return args;
  const f = findListed(listings, url);
  if (!f) return args;
  return {
    ...args,
    source_modified: args.source_modified ?? (listedDate(f) || undefined),
    source_file: args.source_file ?? (f.file || f.name || undefined),
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
        const { entry, created } = await ledger.add(
          withSource(args, await storedListings(store)),
          today
        );
        return {
          saved: created
            ? 'added'
            : 'updated: this event was already saved, so it was not added twice',
          entry: shape(entry, now, {}),
        };
      }
      case 'update': {
        const entry = await ledger.update(
          String(args.id ?? ''),
          withSource(args, await storedListings(store))
        );
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
  const only = typeof args.subject === 'string' ? args.subject.trim().toUpperCase() : '';
  const inScope = entries.filter((e) => !only || e.code === only);
  const live = inScope.filter((e) => daysLeftOf(e, now).end >= 0);
  const shown = args.include_past === true ? inScope : live;
  const rows = shown.map((e) => shape(e, now, listings));
  // The whole answer goes into the student's chat and Claude's context: drop the last rows until it fits.
  let count = rows.length;
  while (count > 1 && JSON.stringify(rows.slice(0, count), null, 2).length > BUDGET) count--;
  const hidden = inScope.length - live.length;
  return {
    count: shown.length,
    ...(count < rows.length
      ? { note: `${rows.length - count} more do not fit: pass subject to narrow the list.` }
      : {}),
    ...(args.include_past !== true && hidden > 0
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
