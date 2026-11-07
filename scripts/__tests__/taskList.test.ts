import { describe, it, expect } from 'vitest';
import { findTasks, doneRequests, noteRequests } from '../task-list/lib.mjs';

// A made-up doc in the shape `read_doc` (Google Docs connector) returns.
// Checklist state is NOT in this JSON — the Docs API omits it — so `done`
// comes from the markdown export (`read_file_content`), where a ticked
// checklist item renders as ~~struck~~.
let at = 1;
const para = (
  text: string,
  opts: { heading?: string; bullet?: boolean; images?: string[] } = {}
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
      ...(opts.bullet ? { bullet: { listId: 'kix.list' } } : {}),
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

  it('separates Claude notes from the task text', () => {
    expect(tasks[1].details).toEqual(['viz foto']);
    expect(tasks[3].notes).toEqual(['↳ Claude 2026-11-07: needs a design first']);
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
    const text = '\u000b↳ Claude 2026-11-07: blocked: needs the IS HTML sample';
    expect(insert.insertText).toEqual({ text, location: { index: task.textEnd } });
    expect(italic.updateTextStyle.range).toEqual({
      startIndex: task.textEnd + 1,
      endIndex: task.textEnd + text.length,
    });
  });
});
