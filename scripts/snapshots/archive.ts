/**
 * The snapshot archive on disk (a folder in Drive):
 *
 *   changes.md                       one section per run: what changed, with the added lines
 *   state.json                       per page: hash of its text, the day it was last saved and seen
 *   days/<date>/<site>/<page>.html   the page as served, only on days its text changed
 *   days/<date>/<site>/<page>.txt    its visible text (pageText)
 *
 * A page on a given day = its newest file in days/ on or before that day.
 */
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pageText } from './pageText';

export interface Capture {
  /** `<site>/<page>`, e.g. `is/exam-terms`, `webiskam/Konta`. */
  key: string;
  html: string;
}

export interface DayInput {
  date: string;
  time: string;
  captures: Capture[];
  /** One line each: a site that could not be read this morning, and why. */
  problems: string[];
}

interface PageState {
  hash: string;
  saved: string;
  seen: string;
}

interface State {
  pages: Record<string, PageState>;
}

const MAX_LINES_SHOWN = 12;
const MAX_LINE = 200;

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex');

function readState(root: string): State {
  const file = join(root, 'state.json');
  if (!existsSync(file)) return { pages: {} };
  return JSON.parse(readFileSync(file, 'utf8')) as State;
}

function writeAtomic(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
}

/** Lines of `next` not in `prev` (as a multiset), and how many of `prev` went. */
function lineDiff(prev: string, next: string): { added: string[]; removed: number } {
  const left = new Map<string, number>();
  for (const line of prev.split('\n')) left.set(line, (left.get(line) ?? 0) + 1);
  const added: string[] = [];
  for (const line of next.split('\n')) {
    const n = left.get(line) ?? 0;
    if (n > 0) left.set(line, n - 1);
    else added.push(line);
  }
  const removed = [...left.values()].reduce((a, b) => a + b, 0);
  return { added, removed };
}

const short = (line: string) => (line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}…` : line);

export function recordDay(root: string, input: DayInput): { changed: string[] } {
  const state = readState(root);
  const firsts: string[] = [];
  const entries: string[] = [];
  const changed: string[] = [];

  for (const { key, html } of input.captures) {
    const text = pageText(html);
    const hash = hashOf(text);
    const prev = state.pages[key];
    if (prev && prev.hash === hash) {
      prev.seen = input.date;
      continue;
    }
    const rel = `days/${input.date}/${key}`;
    writeAtomic(join(root, `${rel}.html`), html);
    writeAtomic(join(root, `${rel}.txt`), `${text}\n`);
    changed.push(key);
    if (prev) {
      const before = readFileSync(join(root, `days/${prev.saved}/${key}.txt`), 'utf8').replace(
        /\n$/,
        ''
      );
      const { added, removed } = lineDiff(before, text);
      entries.push(`- ${key}: +${added.length} −${removed} → ${rel}.txt`);
      added.slice(0, MAX_LINES_SHOWN).forEach((l) => entries.push(`  + ${short(l)}`));
      if (added.length > MAX_LINES_SHOWN)
        entries.push(`  + … ${added.length - MAX_LINES_SHOWN} more`);
    } else {
      firsts.push(key);
    }
    state.pages[key] = { hash, saved: input.date, seen: input.date };
  }

  const pages = input.captures.length;
  const section = [
    `## ${input.date} ${input.time}`,
    '',
    `${pages} pages read, ${changed.length} changed${changed.length ? '' : ' (no changes)'}`,
    ...input.problems.map((p) => `- ⚠ ${p}`),
    ...(firsts.length ? [`- first snapshot: ${firsts.join(', ')}`] : []),
    ...entries,
    '',
    '',
  ].join('\n');

  mkdirSync(root, { recursive: true });
  appendFileSync(join(root, 'changes.md'), section);
  writeAtomic(join(root, 'state.json'), `${JSON.stringify(state, null, 1)}\n`);
  return { changed };
}
