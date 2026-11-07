import { describe, it, expect } from 'vitest';
import { findTasks } from '../task-list/lib.mjs';
import { doneRequests, noteRequests } from '../task-list/requests.mjs';

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
