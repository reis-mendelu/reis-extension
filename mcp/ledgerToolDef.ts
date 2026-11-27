// What Claude reads about mendelu_ledger before it chooses to call it: when to use it, and the
// shape of a call. The only thing a model that has never seen reIS knows is this text, so it says
// when to save, what not to save, and what to pass for a date to be rechecked later.
import { z } from 'zod';
import { KINDS, SOURCES } from './ledgerEntry';

export const LEDGER_TOOL = {
  name: 'mendelu_ledger',
  title: "The student's list of upcoming tests, defences and events",
  description:
    'The list of dated things the student has to be somewhere for: tests, credit tests, project defences, resits, programme days, events, unregistration deadlines. YOU keep it; reIS only stores it and shows it in the "upcoming" part of mendelu_overview, soonest first, with days left. ' +
    'WHEN TO USE: after you read a harmonogram, passing conditions, a project brief, a mail or anything else that names a date the student must act on or attend, SAVE EVERY dated event you found with action "add", one call per event, before you answer. Do not leave it only in your reply: the next conversation starts from the overview and finds it there. Also add an event the student tells you about. ' +
    'DO NOT add what reIS already shows: registered exam terms and open assignment deadlines come from IS by themselves. ' +
    'FIELDS: title (what, short), kind, date YYYY-MM-DD (Prague time), time HH:MM when the file gives one; for a stretch of days (a programme week, "in the 12th week") pass `until` as the last day. code = subject code. room, length_minutes, points, rule (minimum points, no aids), unregister_by (the last day to unregister), depends_on (what needs it, e.g. a programme that needs this test passed). source_kind says where it came from: is, course_file, mail, calendar or student. For a course_file ALWAYS pass source_url (the file\'s `url` from the overview) and source_modified (its `modified`) and source_file (its name): that is how reIS notices the file was replaced later and marks the entry "recheck". ' +
    'STATED OR INFERRED: basis "stated" when the file names the date. When you worked it out (the "12th week" is 14-18 December), pass basis "inferred" and inferred_how; the overview then tells the student to confirm it with the teacher. Never present an inferred date as certain. ' +
    'OTHER ACTIONS: "list" shows the saved events, soonest first (past ones only with include_past, one entry with id, and a replaced source file shows as recheck); a long list is cut and says which offset to pass next; "update" changes the fields you pass for an id (an empty string clears one; pass source_modified to say you rechecked the file); "remove" deletes one. Adding the same event twice updates it, it does not duplicate. It changes nothing in IS and nothing in the student\'s calendar.',
  input: {
    action: z.enum(['list', 'add', 'update', 'remove']).describe('What to do.'),
    id: z
      .string()
      .max(20)
      .optional()
      .describe('update, remove: the event id (ev-…) from list or add. list: only that entry.'),
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
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'list: skip this many events (soonest first). A long list says which offset to pass next.'
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe(
        'list: at most this many events. Fewer come back when the answer would be too long.'
      ),
  },
} as const;
