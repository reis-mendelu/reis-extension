import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findTasks } from '../task-list/lib.mjs';
import { doneRequests, noteRequests, notesRequests, pragueDate } from '../task-list/requests.mjs';
import { NOTE_MAX, restyleRequests } from '../task-list/style.mjs';

// A made-up doc in the shape `read_doc` (Google Docs connector) returns.
// Checklist state is NOT in this JSON — the Docs API omits it — so `done`
// comes from the markdown export (`read_file_content`), where a ticked
// checklist item renders as ~~struck~~.
let at = 1;
const para = (
  text: string,
  opts: { heading?: string; bullet?: boolean; nesting?: number; images?: string[] } = {}
) => {
  const startIndex = at;
  const elements: object[] = [];
  if (text) {
    elements.push({
      startIndex: at,
      endIndex: at + text.length,
      textRun: { content: text, textStyle: {} },
    });
    at += text.length;
  }
  for (const id of opts.images ?? []) {
    elements.push({
      startIndex: at,
      endIndex: at + 1,
      inlineObjectElement: { inlineObjectId: id },
    });
    at += 1;
  }
  elements.push({ startIndex: at, endIndex: at + 1, textRun: { content: '\n', textStyle: {} } });
  at += 1;
  return {
    startIndex,
    endIndex: at,
    paragraph: {
      elements,
      paragraphStyle: { namedStyleType: opts.heading ?? 'NORMAL_TEXT' },
      ...(opts.bullet
        ? {
            bullet: {
              listId: 'kix.list',
              ...(opts.nesting ? { nestingLevel: opts.nesting } : {}),
            },
          }
        : {}),
    },
  };
};

const body = [
  para('Nedělat', { heading: 'HEADING_2' }),
  para('do not pick me', { bullet: true }),
  para('Bucket list', { heading: 'HEADING_2' }),
  para('fix the map pin colour', { bullet: true }),
  para('rename the tab\u000bviz foto', { bullet: true, images: ['img.a'] }),
  para('', { images: ['img.b'] }),
  para('already shipped thing', { bullet: true }),
  para('vague idea\u000b↳ Claude 2026-11-07: needs a design first', { bullet: true }),
  para('Archive', { heading: 'HEADING_1' }),
  para('Sprint 15', { heading: 'HEADING_2' }),
  para('archived task', { bullet: true }),
];

const uri = (id: string) => ({
  inlineObjectProperties: {
    embeddedObject: { imageProperties: { contentUri: `https://docs.example/${id}` } },
  },
});
const doc = {
  content: {
    revisionId: 'rev-1',
    tabs: [
      {
        documentTab: {
          body: { content: body },
          inlineObjects: { 'img.a': uri('img.a'), 'img.b': uri('img.b') },
        },
      },
    ],
  },
};

const markdown = `## Nedělat
  - do not pick me
## Bucket list
  - fix the map pin colour
  - rename the tab  viz foto
  - ~~\\~\\~already shipped thing\\~\\~~~
  - vague idea  ↳ Claude 2026-11-07: needs a design first
# – Archive
## Sprint 15
  - archived task`;

describe('findTasks', () => {
  const tasks = findTasks(doc, markdown);

  it('reads only the Bucket list — never other sections or the archive', () => {
    expect(tasks.map((t) => t.title)).toEqual([
      'fix the map pin colour',
      'rename the tab',
      'already shipped thing',
      'vague idea',
    ]);
  });

  it('takes done-state from the markdown export', () => {
    expect(tasks.map((t) => t.done)).toEqual([false, false, true, false]);
  });

  it('attaches inline images and image-only paragraphs that follow a task', () => {
    expect(tasks[1].images.map((i) => i.id)).toEqual(['img.a', 'img.b']);
    expect(tasks[1].images[0].uri).toBe('https://docs.example/img.a');
    expect(tasks[0].images).toEqual([]);
  });

  it('keeps the lines under a title as a thread, Claude notes marked as such', () => {
    expect(tasks[1].thread).toEqual([{ by: 'human', text: 'viz foto' }]);
    expect(tasks[3].thread).toEqual([
      { by: 'claude', text: '↳ Claude 2026-11-07: needs a design first' },
    ]);
  });

  it('matches a task containing a bare URL, which the export wraps in <…>', () => {
    const d = {
      content: {
        revisionId: 'r',
        tabs: [
          {
            documentTab: {
              body: {
                content: [
                  para('Bucket list', { heading: 'HEADING_2' }),
                  para('put https://x.example/a into the app', { bullet: true }),
                ],
              },
            },
          },
        ],
      },
    };
    const md = '## Bucket list\n  - put <https://x.example/a> into the app';
    expect(findTasks(d, md)[0].done).toBe(false);
  });

  it('reads a plain paragraph under a task, with its image, as a reply to it', () => {
    const d = {
      content: {
        revisionId: 'r',
        tabs: [
          {
            documentTab: {
              body: {
                content: [
                  para('Bucket list', { heading: 'HEADING_2' }),
                  para('stáže\u000b↳ Claude 2026-11-07: merge? (y/n) ∎', { bullet: true }),
                  para('redundant text ', { images: ['img.r'] }),
                  para('next task', { bullet: true }),
                ],
              },
              inlineObjects: { 'img.r': uri('img.r') },
            },
          },
        ],
      },
    };
    const [task] = findTasks(d, '## Bucket list\n  - stáže\n\nredundant text\n  - next task');
    expect(task!.status).toBe('answered');
    expect(task!.thread.at(-1)).toEqual({ by: 'human', text: 'redundant text' });
    expect(task!.images.map((i) => i.id)).toEqual(['img.r']);
    // A later note goes after the reply, so the thread stays in order.
    expect(task!.textEnd).toBe(d.content.tabs[0].documentTab.body.content[2].endIndex - 1);
  });

  it('tells asked, answered, claimed and new apart, so a later run knows what to pick up', () => {
    const q = '↳ Claude 2026-11-07: (a) or (b)?';
    const d = {
      content: {
        revisionId: 'r',
        tabs: [
          {
            documentTab: {
              body: {
                content: [
                  para('Bucket list', { heading: 'HEADING_2' }),
                  para('untouched', { bullet: true }),
                  para(`waiting\u000b${q}`, { bullet: true }),
                  para(`answered inline\u000b${q}\u000bb, on both trees`, { bullet: true }),
                  para(`same line\u000b${q} ∎ b, top bar`, { bullet: true }),
                  para(`answered nested\u000b${q}`, { bullet: true }),
                  para('a please', { bullet: true, nesting: 1 }),
                  para('busy\u000b↳ Claude 2026-11-07: in progress — branch claude/x', {
                    bullet: true,
                  }),
                ],
              },
            },
          },
        ],
      },
    };
    const md =
      '## Bucket list\n  - untouched\n  - waiting\n  - answered inline\n  - same line\n  - answered nested\n      - a please\n  - busy';
    const tasks = findTasks(d, md);
    expect(tasks.map((t) => [t.title, t.status])).toEqual([
      ['untouched', 'new'],
      ['waiting', 'asked'],
      ['answered inline', 'answered'],
      ['same line', 'answered'],
      ['answered nested', 'answered'],
      ['busy', 'claimed'],
    ]);
    // Typed straight after Claude's note: the ∎ end mark splits it off.
    expect(tasks[3].thread).toEqual([
      { by: 'claude', text: `${q} ∎` },
      { by: 'human', text: 'b, top bar' },
    ]);
    // A nested reply belongs to its task: no extra task, and a new note goes after it.
    expect(tasks[4].thread.at(-1)).toEqual({ by: 'human', text: 'a please' });
    expect(tasks[4].textEnd).toBe(d.content.tabs[0].documentTab.body.content[6].endIndex - 1);
  });

  it('can read another section by name', () => {
    expect(findTasks(doc, markdown, { section: 'Sprint 15' }).map((t) => t.title)).toEqual([
      'archived task',
    ]);
  });
});

describe('write requests', () => {
  const [task] = findTasks(doc, markdown);

  it('ticks a task by striking its title and prefixing ✅, pinned to the revision read', () => {
    const out = doneRequests(task, 'rev-1', 'PR #12');
    expect(out.writeControl).toEqual({ requiredRevisionId: 'rev-1' });
    const [note, strike, prefix] = out.requests;
    expect(note.insertText.location.index).toBe(task.textEnd);
    expect(note.insertText.text).toBe(' (PR #12)');
    expect(strike.updateTextStyle.range).toEqual({
      startIndex: task.start,
      endIndex: task.titleEnd,
    });
    expect(strike.updateTextStyle.textStyle).toEqual({ strikethrough: true });
    expect(prefix.insertText).toEqual({ text: '✅ ', location: { index: task.start } });
  });

  it('appends a note on a soft line break so the task stays one checklist item', () => {
    const out = noteRequests(task, 'rev-1', 'blocked: needs the IS HTML sample', '2026-11-07');
    const [insert, italic] = out.requests;
    const text = '\u000b↳ Claude 2026-11-07: blocked: needs the IS HTML sample ∎';
    expect(insert.insertText).toEqual({ text, location: { index: task.textEnd } });
    expect(italic.updateTextStyle.range).toEqual({
      startIndex: task.textEnd + 1,
      endIndex: task.textEnd + text.length,
    });
  });

  // Task List, 2026-11-08: Docs cannot collapse a list item, and full-size
  // notes buried Dominik's own text. A note recedes and stays short instead.
  it('writes a note small and grey, and refuses one longer than a question', () => {
    const [, style] = noteRequests(task, 'rev-1', 'ok?', '2026-11-08').requests;
    expect(style.updateTextStyle.textStyle).toMatchObject({
      italic: true,
      fontSize: { magnitude: 9, unit: 'PT' },
    });
    expect(style.updateTextStyle.fields).toBe('italic,fontSize,foregroundColor');
    expect(() => noteRequests(task, 'rev-1', 'x'.repeat(NOTE_MAX + 1), '2026-11-08')).toThrow(
      /keep it under/
    );
  });

  it('makes a URL in the note clickable', () => {
    const url = 'https://claude.ai/artifact/abc';
    const out = noteRequests(
      task,
      'rev-1',
      `Screenshoty: ${url} — merge? (y/n)`,
      '2026-11-07',
      url
    );
    const text: string = out.requests[0].insertText.text;
    const start = task.textEnd + text.indexOf(url);
    expect(out.requests[2].updateTextStyle).toEqual({
      range: { startIndex: start, endIndex: start + url.length },
      textStyle: { link: { url } },
      fields: 'link',
    });
  });
});

// Findings from cubic's review of #650.
describe('edge cases', () => {
  const docOf = (...content: object[]) => ({
    content: { revisionId: 'r', tabs: [{ documentTab: { body: { content } } }] },
  });

  it('counts a task done only when its title is struck, not a word inside it', () => {
    const d = docOf(
      para('Bucket list', { heading: 'HEADING_2' }),
      para('rename old tab', { bullet: true })
    );
    expect(findTasks(d, '## Bucket list\n  - rename ~~old~~ tab')[0]!.done).toBe(false);
    expect(findTasks(d, '## Bucket list\n  - ~~rename old tab~~')[0]!.done).toBe(true);
  });

  it('gives tasks whose titles share a prefix each their own done-state', () => {
    const d = docOf(
      para('Bucket list', { heading: 'HEADING_2' }),
      para('fix map pins', { bullet: true }),
      para('fix map', { bullet: true })
    );
    const md = '## Bucket list\n  - ~~fix map pins~~\n  - fix map';
    expect(findTasks(d, md).map((t) => t.done)).toEqual([true, false]);
  });

  it('does not read a subheading inside the section as a reply', () => {
    const d = docOf(
      para('Bucket list', { heading: 'HEADING_2' }),
      para('a task', { bullet: true }),
      para('Later', { heading: 'HEADING_3' })
    );
    const [task] = findTasks(d, '## Bucket list\n  - a task\n### Later');
    expect(task!.thread).toEqual([]);
    expect(task!.status).toBe('new');
  });

  it('matches a struck task whose URL the export turned into a markdown link', () => {
    const d = docOf(
      para('Bucket list', { heading: 'HEADING_2' }),
      para('✅ put https://x.example/ in the app (PR #1, merged)', { bullet: true })
    );
    const md =
      '## Bucket list\n  - ~~✅ put~~ [~~https://x.example/~~](https://x.example/) ~~in the app~~ (PR \\#1, merged)';
    expect(findTasks(d, md)[0]!.done).toBe(true);
  });

  // Task List, 2026-11-08: a run wrote "I don't have the PDF" under a task
  // that linked it, and the task read as unmatched.
  it('lists a linked Drive file with its id, even when the export wraps the link text', () => {
    const task = para('send S-klub the posters - venues.pdf', { bullet: true });
    const run = (task.paragraph.elements[0] as { textRun: { textStyle: object } }).textRun;
    run.textStyle = {
      link: { url: 'https://drive.google.com/open?id=18vDQEnxxJ0DCMnd91dAbbz8dtE31hQI5' },
    };
    const reply = para('see https://sportera.cz/', { bullet: true, nesting: 1 });
    const replyRun = (reply.paragraph.elements[0] as { textRun: { textStyle: object } }).textRun;
    replyRun.textStyle = { link: { url: 'https://sportera.cz/' } };
    const d = docOf(para('Bucket list', { heading: 'HEADING_2' }), task, reply);
    const md =
      '## Bucket list\n  - [send S-klub the posters - venues.pdf  \n    ](https://drive.google.com/open?id=18vDQEnxxJ0DCMnd91dAbbz8dtE31hQI5)';
    const [t] = findTasks(d, md);
    expect(t!.done).toBe(false);
    expect(t!.links).toEqual([
      {
        text: 'send S-klub the posters - venues.pdf',
        url: 'https://drive.google.com/open?id=18vDQEnxxJ0DCMnd91dAbbz8dtE31hQI5',
        driveId: '18vDQEnxxJ0DCMnd91dAbbz8dtE31hQI5',
      },
      { text: 'see https://sportera.cz/', url: 'https://sportera.cz/' },
    ]);
  });

  it('restyles only Claude notes, at their exact doc positions, never the replies', () => {
    const title = 'fix it';
    const note = '↳ Claude 2026-11-07: (a) or (b)? ∎';
    const task = para(`${title}\u000b${note} b please`, { bullet: true, images: [] });
    const img = para('', { images: ['img1'] });
    const later = para(`\u000b${note}`, { bullet: true, nesting: 1 });
    const d = docOf(para('Bucket list', { heading: 'HEADING_2' }), task, img, later);
    const spans = restyleRequests(d, 'Bucket list').requests.map((r) => r.updateTextStyle.range);
    expect(spans).toEqual([
      {
        startIndex: task.startIndex + title.length + 1,
        endIndex: task.startIndex + title.length + 1 + note.length,
      },
      { startIndex: later.startIndex + 1, endIndex: later.startIndex + 1 + note.length },
    ]);
  });

  it('dates notes in Prague, where a UTC date would still say yesterday', () => {
    expect(pragueDate(new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08');
    expect(pragueDate(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
  });

  it('fails loudly when list --task names a task that does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'task-list-'));
    const doc = join(dir, 'doc.json');
    const md = join(dir, 'md.txt');
    writeFileSync(
      doc,
      JSON.stringify(
        docOf(para('Bucket list', { heading: 'HEADING_2' }), para('only one', { bullet: true }))
      )
    );
    writeFileSync(md, '## Bucket list\n  - only one');
    const cli = join(process.cwd(), 'scripts/task-list/cli.mjs');
    expect(() =>
      execFileSync('node', [cli, 'list', '--doc', doc, '--md', md, '--task', '9'], {
        stdio: 'pipe',
      })
    ).toThrow(/No task #9/);
  });
});

// One run asks every question it has in ONE write: each write changes the
// revision, so per-note writes made a run stop after its first question.
describe('notesRequests', () => {
  it('batches notes for several tasks into one payload, last task first', () => {
    const d = {
      content: {
        revisionId: 'r',
        tabs: [
          {
            documentTab: {
              body: {
                content: [
                  para('Bucket list', { heading: 'HEADING_2' }),
                  para('first', { bullet: true }),
                  para('second', { bullet: true }),
                ],
              },
            },
          },
        ],
      },
    };
    const tasks = findTasks(d, '## Bucket list\n  - first\n  - second');
    const out = notesRequests(
      tasks,
      'r',
      [
        { task: 1, text: '(a) or (b)?' },
        { task: 2, text: 'which page?' },
      ],
      '2026-11-07'
    );
    expect(out.writeControl).toEqual({ requiredRevisionId: 'r' });
    const inserts = out.requests.filter((r) => 'insertText' in r);
    // Highest index first, so inserting the second note never shifts the first.
    expect(inserts.map((r) => r.insertText.location.index)).toEqual([
      tasks[1]!.textEnd,
      tasks[0]!.textEnd,
    ]);
    expect(inserts[0]!.insertText.text).toContain('which page? ∎');
  });

  it('refuses a note for a task number that does not exist', () => {
    const d = {
      content: {
        revisionId: 'r',
        tabs: [
          {
            documentTab: {
              body: {
                content: [
                  para('Bucket list', { heading: 'HEADING_2' }),
                  para('only', { bullet: true }),
                ],
              },
            },
          },
        ],
      },
    };
    const tasks = findTasks(d, '## Bucket list\n  - only');
    expect(() => notesRequests(tasks, 'r', [{ task: 5, text: 'x' }], '2026-11-07')).toThrow(
      /No task #5/
    );
  });
});
