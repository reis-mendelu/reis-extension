// Pure logic for the reIS Task List Google Doc. Plain JS: runs on bare Node.
// Two reads, because neither alone is enough:
// - `read_doc` (Docs API JSON): character indices to write at, and image URIs.
// - `read_file_content` (markdown export): a ticked checklist item comes back
//   ~~struck~~; the Docs API omits that state. No API can tick it: ✅ + strike.

const OBJECT = '\uFFFC';
export const SOFT_BREAK = '\u000b';
// Claude's notes start with this. BMP characters only: the markdown export
// garbles anything outside it (🤖 comes back as mojibake), ✅ and ↳ survive.
export const NOTE_MARK = '↳ Claude';
// Ends every note, so a reply typed after it on the same line reads as human.
export const NOTE_END = '∎';

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
  return (
    s
      .replace(/\\(.)/g, '$1')
      // A styled URL comes back as [text](url): keep the text, as the doc shows it.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/~~|\*\*|__|[<>\uFFFC]/g, '')
      .replace(/[\s\u000b ]+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

function headingLevel(paragraph) {
  const m = /^HEADING_(\d)$/.exec(paragraph.paragraphStyle?.namedStyleType ?? '');
  if (m) return Number(m[1]);
  return paragraph.paragraphStyle?.namedStyleType === 'TITLE' ? 0 : null;
}

export function paragraphs(body) {
  return body
    .filter((el) => el.paragraph)
    .map((el) => {
      const p = el.paragraph;
      let text = '';
      const images = [];
      const links = [];
      for (const e of p.elements) {
        if (e.textRun) text += e.textRun.content;
        const url = e.textRun?.textStyle?.link?.url;
        if (url) links.push({ text: e.textRun.content.trim(), url });
        if (e.inlineObjectElement) images.push(e.inlineObjectElement.inlineObjectId);
        // Chips and images take index space but carry no text: pad them, so an
        // offset into `text` stays an offset into the doc.
        if (!e.textRun) text += OBJECT.repeat(e.endIndex - e.startIndex);
      }
      return {
        start: el.startIndex,
        end: el.endIndex,
        text,
        images,
        links,
        bullet: !!p.bullet,
        nesting: p.bullet?.nestingLevel ?? 0,
        level: headingLevel(p),
      };
    });
}

export function sectionSlice(items, section, levelOf, textOf) {
  const target = normalize(section);
  const from = items.findIndex((it) => levelOf(it) !== null && normalize(textOf(it)) === target);
  if (from === -1) return [];
  const level = levelOf(items[from]);
  const rest = items.slice(from + 1);
  const to = rest.findIndex((it) => levelOf(it) !== null && levelOf(it) <= level);
  return to === -1 ? rest : rest.slice(0, to);
}

function markdownDoneMap(markdown, section) {
  // A link chip's text can run onto the next line (`[file.pdf  \n  ](url)`),
  // which would cut the item off from its title: keep each link on one line.
  const lines = markdown
    .replace(/\[([^\]]*)\]\(/g, (_, text) => `[${text.replace(/\s*\n\s*/g, ' ')}](`)
    .split('\n');
  const levelOf = (l) => /^(#+)\s/.exec(l)?.[1].length ?? null;
  const textOf = (l) => l.replace(/^#+\s*/, '');
  return (
    sectionSlice(lines, section, levelOf, textOf)
      .filter((l) => /^\s*-\s/.test(l))
      // Done = the item itself is struck (a ticked checklist box, or ✅ + strike),
      // not a struck word somewhere inside it.
      .map((l) => ({ text: normalize(l.replace(/^\s*-\s/, '')), done: /^\s*-\s+~~/.test(l) }))
  );
}

function linesOf(text) {
  if (!text.startsWith(NOTE_MARK)) return [{ by: 'human', text }];
  const end = text.indexOf(NOTE_END);
  if (end === -1) return [{ by: 'claude', text }];
  const reply = text.slice(end + NOTE_END.length).trim();
  const note = { by: 'claude', text: text.slice(0, end + NOTE_END.length) };
  return reply ? [note, { by: 'human', text: reply }] : [note];
}

/**
 * Where a task stands in the ask → answer → work loop:
 * new (Claude never wrote on it), asked (Claude's question is the last word),
 * answered (someone wrote after Claude), claimed (a session is working on it).
 */
function statusOf(task) {
  if (task.done === true) return 'done';
  const lastClaude = task.thread.findLastIndex((l) => l.by === 'claude');
  if (lastClaude === -1) return 'new';
  if (lastClaude < task.thread.length - 1) return 'answered';
  const body = task.thread[lastClaude].text.replace(/^↳ Claude [\d-]+:\s*/, '');
  return /^in progress\b/i.test(body) ? 'claimed' : 'asked';
}

/**
 * Links in a task or its replies: a Drive file (a PDF, a doc) or a web page is
 * part of the task, so `list` shows each one with its Drive file id, if any.
 */
function addLinks(task, links) {
  for (const { text, url } of links) {
    if (task.links.some((l) => l.url === url)) continue;
    const driveId = /(?:drive|docs)\.google\.com\/.*(?:[?&]id=|\/d\/)([\w-]{10,})/.exec(url)?.[1];
    task.links.push({ text, url, ...(driveId && { driveId }) });
  }
}

/**
 * The section a session works: the current sprint. The Backlog's sections are
 * the pool Dominik picks the next sprint from (`--section Backlog`).
 */
export const DEFAULT_SECTION = 'Current sprint';

/**
 * Tasks in one section (default: the current sprint), numbered from 1 in doc
 * order. `done` is null when the markdown line could not be matched. Lines
 * under a title — soft line breaks in its item, or nested bullets below it —
 * form the task's `thread`.
 */
export function findTasks(docJson, markdownJson, { section = DEFAULT_SECTION } = {}) {
  const { body, inlineObjects } = unwrapDoc(docJson);
  const md = markdownDoneMap(unwrapMarkdown(markdownJson), section);
  const uriOf = (id) =>
    inlineObjects[id]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri ?? null;
  const tasks = [];
  const used = new Set();
  let subsection = null;
  for (const p of sectionSlice(
    paragraphs(body),
    section,
    (p) => p.level,
    (p) => p.text
  )) {
    // A subheading inside the section is structure, never a task or a reply;
    // it names the group the tasks below it belong to.
    if (p.level !== null) {
      subsection = p.text.replace(/\n$/, '').trim();
      continue;
    }
    const visible = p.text.replace(/\n$/, '');
    const words = visible.replaceAll(OBJECT, '').trim();
    if (!words) {
      tasks.at(-1)?.images.push(...p.images.map((id) => ({ id, uri: uriOf(id) })));
      continue;
    }
    const [title, ...lines] = visible.split(SOFT_BREAK).map((l) => l.replaceAll(OBJECT, '').trim());
    const parent = tasks.at(-1);
    // A nested bullet or a plain paragraph under a task is a reply to it.
    if (!p.bullet && !parent) continue;
    if ((p.nesting > 0 || !p.bullet) && parent) {
      parent.thread.push(...[title, ...lines].filter(Boolean).flatMap(linesOf));
      parent.images.push(...p.images.map((id) => ({ id, uri: uriOf(id) })));
      addLinks(parent, p.links);
      parent.textEnd = p.end - 1;
      continue;
    }
    const titleLen = visible.split(SOFT_BREAK)[0].replace(/[\s\uFFFC]+$/, '').length;
    const key = normalize(title);
    // One markdown line per task, in order: two titles sharing a prefix must
    // not both take the first line's state.
    const at = md.findIndex((m, i) => !used.has(i) && m.text.startsWith(key));
    if (at !== -1) used.add(at);
    const match = md[at];
    tasks.push({
      n: tasks.length + 1,
      subsection,
      title,
      thread: lines.filter(Boolean).flatMap(linesOf),
      done: match ? match.done : null,
      start: p.start,
      titleEnd: p.start + titleLen,
      textEnd: p.end - 1,
      images: p.images.map((id) => ({ id, uri: uriOf(id) })),
      links: [],
    });
    addLinks(tasks.at(-1), p.links);
  }
  return tasks.map((t) => ({ ...t, status: statusOf(t) }));
}
