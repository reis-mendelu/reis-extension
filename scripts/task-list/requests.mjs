// update_doc payloads for the reIS Task List. Pure: the CLI prints them and
// Claude passes them to the Google Docs connector unchanged.
import { SOFT_BREAK, NOTE_MARK, NOTE_END } from './lib.mjs';

/** Marks a task done: ✅ + strikethrough, optional "(note)". */
export function doneRequests(task, revisionId, note) {
  const requests = [];
  // Highest index first, so earlier inserts never shift a later range.
  if (note)
    requests.push({ insertText: { text: ` (${note})`, location: { index: task.textEnd } } });
  requests.push({
    updateTextStyle: {
      range: { startIndex: task.start, endIndex: task.titleEnd },
      textStyle: { strikethrough: true },
      fields: 'strikethrough',
    },
  });
  requests.push({ insertText: { text: '✅ ', location: { index: task.start } } });
  return { requests, writeControl: { requiredRevisionId: revisionId } };
}

/**
 * Appends an italic "↳ Claude" note inside the task's own item. `link`, when
 * it appears in the message, becomes clickable — the review page, a PR.
 */
export function noteRequests(task, revisionId, message, date, link) {
  const text = `${SOFT_BREAK}${NOTE_MARK} ${date}: ${message} ${NOTE_END}`;
  const at = task.textEnd;
  const requests = [
    { insertText: { text, location: { index: at } } },
    {
      updateTextStyle: {
        range: { startIndex: at + 1, endIndex: at + text.length },
        textStyle: { italic: true },
        fields: 'italic',
      },
    },
  ];
  const offset = link ? text.indexOf(link) : -1;
  if (offset !== -1) {
    requests.push({
      updateTextStyle: {
        range: { startIndex: at + offset, endIndex: at + offset + link.length },
        textStyle: { link: { url: link } },
        fields: 'link',
      },
    });
  }
  return { requests, writeControl: { requiredRevisionId: revisionId } };
}
