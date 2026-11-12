// How Claude's notes look in the doc. Google Docs cannot collapse a list
// item and the connector cannot start a comment, so a note recedes instead:
// small, grey, italic, under Dominik's own text, which keeps the doc's size.
import {
  DEFAULT_SECTION,
  NOTE_MARK,
  NOTE_END,
  SOFT_BREAK,
  paragraphs,
  sectionSlice,
  unwrapDoc,
} from './lib.mjs';

export const NOTE_STYLE = {
  italic: true,
  fontSize: { magnitude: 9, unit: 'PT' },
  foregroundColor: { color: { rgbColor: { red: 0.45, green: 0.45, blue: 0.45 } } },
};
export const NOTE_FIELDS = 'italic,fontSize,foregroundColor';
// A note is a question or a status line, not a report: details go on the
// review page or in the PR.
export const NOTE_MAX = 300;

export function noteStyle(startIndex, endIndex) {
  return {
    updateTextStyle: {
      range: { startIndex, endIndex },
      textStyle: NOTE_STYLE,
      fields: NOTE_FIELDS,
    },
  };
}

/** Every "↳ Claude … ∎" span in a section, as doc index ranges. */
export function noteSpans(docJson, section = DEFAULT_SECTION) {
  const { body } = unwrapDoc(docJson);
  const spans = [];
  for (const p of sectionSlice(
    paragraphs(body),
    section,
    (p) => p.level,
    (p) => p.text
  )) {
    // A subheading is structure, never a note, as in findTasks.
    if (p.level !== null) continue;
    let from = p.text.indexOf(NOTE_MARK);
    while (from !== -1) {
      const next = p.text.indexOf(NOTE_MARK, from + NOTE_MARK.length);
      const lineEnd = p.text.indexOf(SOFT_BREAK, from);
      // The ∎ must close THIS note: on its own line, before any later note.
      const limit = Math.min(...[next, lineEnd, p.text.length].filter((i) => i !== -1));
      const found = p.text.indexOf(NOTE_END, from);
      const end = found !== -1 && found < limit ? found : -1;
      // A note starts a line (Claude writes it after a soft break); the mark
      // anywhere else is someone quoting it. A note with no ∎ has no knowable
      // end, and guessing could grey out a reply: leave it as it is.
      const lineStart = p.text.lastIndexOf(SOFT_BREAK, from - 1) + 1;
      const startsLine = p.text.slice(lineStart, from).trim() === '';
      if (startsLine && end !== -1)
        spans.push({ startIndex: p.start + from, endIndex: p.start + end + NOTE_END.length });
      from = next;
    }
  }
  return spans;
}

/** Restyles the notes already in the doc. Formatting only: no text changes. */
export function restyleRequests(docJson, section) {
  const requests = noteSpans(docJson, section).map((s) => noteStyle(s.startIndex, s.endIndex));
  return { requests, writeControl: { requiredRevisionId: unwrapDoc(docJson).revisionId } };
}
