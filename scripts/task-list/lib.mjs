// Pure logic for the reIS Task List Google Doc. Plain JS so the CLI runs on
// bare Node in any cloud session, before or without `npm ci`.
//
// Two reads, because neither alone is enough:
// - `read_doc` (Docs API JSON): character indices to write at, and image URIs.
// - `read_file_content` (markdown export): whether a checklist box is ticked.
//   The Docs API does not expose checklist state at all — a ticked and an
//   unticked item are identical in its JSON — while the export renders a ticked
//   item as ~~struck~~.
// No Google API can tick the checkbox itself, so "done" is written as a struck
// title with a ✅ prefix, which reads the same in the doc.

const OBJECT = '￼';
const SOFT_BREAK = '\u000b';
// Claude's notes start with this. BMP characters only: the markdown export
// garbles anything outside it (🤖 comes back as mojibake), ✅ and ↳ survive.
const NOTE_MARK = '↳ Claude';

/** Accepts the connector's wrapper ({content: doc}) or the bare document. */
export function unwrapDoc(json) {
  const doc = json.content ?? json;
  const tab = doc.tabs?.[0]?.documentTab ?? doc;
  return {
    revisionId: doc.revisionId,
    body: tab.body.content,
    inlineObjects: tab.inlineObjects ?? {},
  };
}

/** Accepts the connector's wrapper ({fileContent}) or the bare markdown. */
export function unwrapMarkdown(json) {
  return typeof json === 'string' ? json : json.fileContent;
}

function normalize(s) {
  return s
    .replace(/\\(.)/g, '$1')
    .replace(/~~|\*\*|__|[<>]/g, '')
    .replace(/[\s\u000b ]+/g, ' ')
    .trim()
    .toLowerCase();
}

function headingLevel(paragraph) {
  const m = /^HEADING_(\d)$/.exec(paragraph.paragraphStyle?.namedStyleType ?? '');
  if (m) return Number(m[1]);
  return paragraph.paragraphStyle?.namedStyleType === 'TITLE' ? 0 : null;
}

function paragraphs(body) {
  return body
    .filter((el) => el.paragraph)
    .map((el) => {
      const p = el.paragraph;
      let text = '';
      const images = [];
      for (const e of p.elements) {
        if (e.textRun) text += e.textRun.content;
        if (e.inlineObjectElement) {
          text += OBJECT;
          images.push(e.inlineObjectElement.inlineObjectId);
        }
      }
      return {
        start: el.startIndex,
        end: el.endIndex,
        text,
        images,
        bullet: !!p.bullet,
        level: headingLevel(p),
      };
    });
}

function sectionSlice(items, section, levelOf, textOf) {
  const target = normalize(section);
  const from = items.findIndex((it) => levelOf(it) !== null && normalize(textOf(it)) === target);
  if (from === -1) return [];
  const level = levelOf(items[from]);
  const rest = items.slice(from + 1);
  const to = rest.findIndex((it) => levelOf(it) !== null && levelOf(it) <= level);
  return to === -1 ? rest : rest.slice(0, to);
}

function markdownDoneMap(markdown, section) {
  const lines = markdown.split('\n');
  const levelOf = (l) => /^(#+)\s/.exec(l)?.[1].length ?? null;
  const textOf = (l) => l.replace(/^#+\s*/, '');
  return sectionSlice(lines, section, levelOf, textOf)
    .filter((l) => /^\s*-\s/.test(l))
    .map((l) => ({ text: normalize(l.replace(/^\s*-\s/, '')), done: l.includes('~~') }));
}

/**
 * Tasks in one section (default: the Bucket list), numbered from 1 in doc
 * order. `done` is null when the markdown line could not be matched.
 */
export function findTasks(docJson, markdownJson, { section = 'Bucket list' } = {}) {
  const { body, inlineObjects } = unwrapDoc(docJson);
  const md = markdownDoneMap(unwrapMarkdown(markdownJson), section);
  const uriOf = (id) =>
    inlineObjects[id]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri ?? null;
  const tasks = [];
  for (const p of sectionSlice(
    paragraphs(body),
    section,
    (p) => p.level,
    (p) => p.text
  )) {
    const visible = p.text.replace(/\n$/, '');
    const words = visible.replaceAll(OBJECT, '').trim();
    if (!words) {
      tasks.at(-1)?.images.push(...p.images.map((id) => ({ id, uri: uriOf(id) })));
      continue;
    }
    if (!p.bullet) continue;
    const [title, ...lines] = visible.split(SOFT_BREAK).map((l) => l.replaceAll(OBJECT, '').trim());
    const titleLen = visible.split(SOFT_BREAK)[0].replace(/[\s￼]+$/, '').length;
    const key = normalize(title);
    const match = md.find((m) => m.text.startsWith(key));
    tasks.push({
      n: tasks.length + 1,
      title,
      details: lines.filter((l) => l && !l.startsWith(NOTE_MARK)),
      notes: lines.filter((l) => l.startsWith(NOTE_MARK)),
      done: match ? match.done : null,
      start: p.start,
      titleEnd: p.start + titleLen,
      textEnd: p.end - 1,
      images: p.images.map((id) => ({ id, uri: uriOf(id) })),
    });
  }
  return tasks;
}

/** update_doc payload that marks a task done: ✅ + strikethrough, optional "(note)". */
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

/** update_doc payload that appends an italic "↳ Claude" note inside the task's own item. */
export function noteRequests(task, revisionId, message, date) {
  const text = `${SOFT_BREAK}${NOTE_MARK} ${date}: ${message}`;
  return {
    requests: [
      { insertText: { text, location: { index: task.textEnd } } },
      {
        updateTextStyle: {
          range: { startIndex: task.textEnd + 1, endIndex: task.textEnd + text.length },
          textStyle: { italic: true },
          fields: 'italic',
        },
      },
    ],
    writeControl: { requiredRevisionId: revisionId },
  };
}
