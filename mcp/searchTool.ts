// mendelu_search (step 4 of the map, docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md):
// keyword search over the text reIS has saved, all subjects at once. No model, no
// summaries, no network: string search over what is in the store, which it only reads.
import { z } from 'zod';
import type { Store } from './store';
import { countMatches, foldPlain, parseQuery, termRegex } from './searchFold';
import { snippetFor } from './searchSnippet';
import { loadDocs, type Doc } from './searchStore';

// Why "search": it is the word a student and a model both reach for ("search my files for
// the credit test"). The description is all a model that has never seen reIS reads before
// it decides whether to look here, so it says when, what it covers and what to do next.
export const SEARCH_TOOL = {
  name: 'mendelu_search',
  title: 'Search the text of my course files',
  description:
    'Searches, on this computer and without asking IS anything, the text of the course files reIS has saved, in ALL subjects at once, plus every listed file\'s name, folder, date and subject. USE IT BEFORE telling the student that something is not in IS or that you cannot find it: dates (credit test, "zápočtová písemná práce", exam, defence), test topics, passing conditions, points rules, reference sheets, project briefs and deadlines are very often only written inside a course file (a harmonogram, a conditions PDF, a lecture), not in IS\'s exam list or timetable. ' +
    'Case and diacritics do not matter ("zapocet" finds "zápočet"). Several words must ALL be in the same file; put "a phrase in quotes" to match it exactly. A part of a word matches too ("zapoc" finds "zápočtový"). Each hit gives the subject, the file, its date modified, a snippet with the matching words in **bold**, the line, and a `storedPath`. ' +
    'It only finds what is saved. The answer says how many listed files have no saved text yet; those were searched by name only, so when nothing fits, open the likely ones with mendelu_read_file (their `url` is in mendelu_overview or mendelu_subject_files) before saying IS has no answer. A hit marked `stale` was replaced in IS after its text was saved: re-read it with mendelu_read_file. Quote the snippet and name the file when you answer. Read-only.',
  input: {
    query: z
      .string()
      .min(1)
      .max(300)
      .describe(
        'Words to find, e.g. zápočtový test. All words must be in the file; "quoted words" match as a phrase.'
      ),
    subject: z
      .string()
      .min(2)
      .max(30)
      .optional()
      .describe('Only this subject code, e.g. "EBC-PE". Default: every subject.'),
  },
} as const;

/** The most hits one answer carries: it goes into the student's chat and Claude's context. */
export const MAX_HITS = 20;

type Scored = { doc: Doc; score: number; inText: boolean };

/** A file matches when every word is in its name, its metadata or its text; score says how well. */
function score(doc: Doc, terms: string[], text: string | undefined): Scored | null {
  const names = foldPlain([doc.title, doc.file].filter(Boolean).join(' '));
  const meta = foldPlain(
    [doc.code, doc.subjectName, doc.folder, doc.modified && `modified ${doc.modified}`, doc.date]
      .filter(Boolean)
      .join(' ')
  );
  let nameHits = 0;
  let metaHits = 0;
  let bodyOccurrences = 0;
  let inText = false;
  for (const t of terms) {
    const inName = names.includes(t);
    const inMeta = !inName && meta.includes(t);
    const n = text ? countMatches(text, termRegex(t), 10) : 0;
    if (!inName && !inMeta && !n) return null;
    if (inName) nameHits++;
    else if (inMeta) metaHits++;
    if (n) inText = true;
    bodyOccurrences += n;
  }
  // A name match outranks everything a body can earn (at most 10 + 15), and only a name does.
  const s =
    nameHits * 50 +
    (nameHits === terms.length ? 50 : 0) +
    Math.min(metaHits * 3, 9) +
    Math.min(bodyOccurrences, 10);
  return { doc, score: s, inText };
}

const byRank = (a: Scored, b: Scored) =>
  b.score - a.score ||
  (a.doc.code ?? '~').localeCompare(b.doc.code ?? '~') ||
  (a.doc.file ?? '').localeCompare(b.doc.file ?? '');

export async function runSearch(store: Store, args: Record<string, unknown>) {
  const q = parseQuery(String(args.query ?? ''));
  if (!q.terms.length) throw new Error('Give at least one word to search for.');
  const only = typeof args.subject === 'string' ? args.subject.trim().toLowerCase() : '';
  const { docs, subjects } = await loadDocs(store);
  if (!docs.length && !subjects) {
    return {
      query: q.display.join(' '),
      found: 0,
      note: 'Nothing is stored yet, so there is nothing to search. Open files with mendelu_read_file (or run mendelu_overview first) and search again.',
    };
  }

  const inScope = docs.filter((d) => !only || d.code?.toLowerCase() === only);
  const withText = inScope.filter((d) => d.text).length;
  const nameOnly = inScope.length - withText;
  const found = inScope
    .map((d) => score(d, q.terms, d.text && foldPlain(d.text)))
    .filter((s): s is Scored => !!s)
    .sort(byRank);

  const hits = found.slice(0, MAX_HITS).map(({ doc, inText }) => {
    const snip = inText && doc.text ? snippetFor(doc.text, q.terms) : null;
    const stale =
      doc.readStamp && doc.listedStamp && doc.readStamp !== doc.listedStamp
        ? `stored text may be out of date: IS now lists this file as "${doc.listedStamp}", the text was saved when it showed "${doc.readStamp}". Read it again with mendelu_read_file.`
        : undefined;
    return {
      subject: doc.code ?? 'unknown (its listing is not stored)',
      ...(doc.subjectName ? { subjectName: doc.subjectName } : {}),
      file: doc.file ?? doc.title ?? '(unnamed)',
      ...(doc.title && doc.file && doc.title !== doc.file ? { document: doc.title } : {}),
      ...(doc.folder ? { folder: doc.folder } : {}),
      modified: doc.modified ?? doc.date ?? 'unknown',
      ...(doc.textPath ? { storedPath: doc.textPath } : { textSaved: 'no, matched by name only' }),
      ...(snip ? { line: snip.line, page: snip.page, snippet: snip.snippet } : {}),
      ...(stale ? { stale } : {}),
      readWith: doc.url,
    };
  });

  const more = found.length - hits.length;
  const coverage = `${withText} file${withText === 1 ? '' : 's'} with saved text searched in full${
    nameOnly ? `; ${nameOnly} listed without saved text searched by name only` : ''
  }.`;
  return {
    query: q.display.map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(' '),
    found: found.length,
    ...(more > 0
      ? { note: `${more} more, narrow the query (more words, a phrase or a subject).` }
      : {}),
    searched: coverage,
    ...(!found.length
      ? {
          note: nameOnly
            ? `No file matches. ${nameOnly} listed file${nameOnly === 1 ? ' has' : 's have'} no saved text: read the likely ones with mendelu_read_file before telling the student IS has no answer.`
            : 'No saved file matches. If the student expects an answer, check mendelu_exams, mendelu_syllabus or the file list for a file not read yet.',
        }
      : {}),
    hits,
  };
}
