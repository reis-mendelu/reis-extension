import { describe, it, expect } from 'vitest';
import {
  renderSubjectNotesHtml,
  serializeSubjectNotesJson,
  notesContentHash,
  renderEmptyNotesHtml,
  serializeEmptyNotesJson,
  type SubjectNotes,
} from '../notesDoc';

const subject: SubjectNotes = {
  code: 'BIK-DBS',
  folderName: 'BIK-DBS - Databases',
  title: 'Poznámky – BIK-DBS',
  files: [
    {
      fileLink: '/auth/dok/1',
      fileName: 'Lecture 1.pdf',
      // one heading, one text, one Q&A toggle
      note: JSON.stringify([
        { id: 'a', type: 'heading', level: 1, content: 'Normalization' },
        { id: 'b', type: 'text', content: 'Reduce <redundancy> & anomalies' },
        { id: 'c', type: 'toggle', question: 'What is 3NF?', answer: 'No transitive deps' },
      ]),
    },
  ],
};

describe('renderSubjectNotesHtml', () => {
  it('migrates legacy blocks (toggle->card, heading/text->notes), escaping HTML', () => {
    const html = renderSubjectNotesHtml(subject);
    expect(html).toContain('<h1>Poznámky – BIK-DBS</h1>');
    expect(html).toContain('not saved back'); // one-way banner
    expect(html).toContain('<h2>Lecture 1.pdf</h2>');
    expect(html).toContain('<b>What is 3NF?</b>'); // toggle question -> card
    expect(html).toContain('No transitive deps'); // toggle answer
    expect(html).toContain('Normalization'); // legacy heading -> notes text
    expect(html).toContain('Reduce &lt;redundancy&gt; &amp; anomalies'); // legacy text -> notes, escaped
    expect(html).not.toContain('<h3>'); // headings are no longer emitted
  });

  it('renders the new {cards,notes} format', () => {
    const html = renderSubjectNotesHtml({
      ...subject,
      files: [
        {
          fileLink: '/y',
          fileName: 'New.pdf',
          note: JSON.stringify({
            cards: [{ id: 'c1', question: 'Q?', answer: 'A.', collapsed: false }],
            notes: 'free <b>jot</b>',
          }),
        },
      ],
    });
    expect(html).toContain('<h2>New.pdf</h2>');
    expect(html).toContain('<b>Q?</b>');
    expect(html).toContain('A.');
    expect(html).toContain('free &lt;b&gt;jot&lt;/b&gt;'); // notes escaped
  });

  it('omits files whose note is empty/whitespace, and the file heading with it', () => {
    const html = renderSubjectNotesHtml({
      ...subject,
      files: [{ fileLink: '/x', fileName: 'Empty.pdf', note: '   ' }],
    });
    expect(html).not.toContain('Empty.pdf');
  });
});

describe('serializeSubjectNotesJson', () => {
  it('stores raw note strings verbatim (lossless) with a schema version', () => {
    const json = JSON.parse(serializeSubjectNotesJson(subject));
    expect(json.schemaVersion).toBe(1);
    expect(json.code).toBe('BIK-DBS');
    expect(json.files[0].fileLink).toBe('/auth/dok/1');
    expect(json.files[0].note).toBe(subject.files[0]!.note); // verbatim; safe: fixed literal
  });
});

describe('notesContentHash', () => {
  it('is stable for identical content and differs when content changes', async () => {
    const a = await notesContentHash(serializeSubjectNotesJson(subject));
    const b = await notesContentHash(serializeSubjectNotesJson(subject));
    expect(a).toBe(b);
    const changed = await notesContentHash(
      serializeSubjectNotesJson({
        ...subject,
        files: [{ ...subject.files[0]!, note: '[]' }], // safe: fixed literal
      })
    );
    expect(changed).not.toBe(a);
  });
});

describe('empty reconciliation helpers', () => {
  it('renders an empty body with no file headings', () => {
    const html = renderEmptyNotesHtml();
    expect(html).not.toContain('<h2>');
    expect(html).toContain('<body>');
  });
  it('serializes an empty sidecar with no files', () => {
    const parsed = JSON.parse(serializeEmptyNotesJson('AAA'));
    expect(parsed.code).toBe('AAA');
    expect(parsed.files).toEqual([]);
  });
});

import { renderSubjectNotesHtmlWithImages } from '../notesDoc';

describe('renderSubjectNotesHtmlWithImages', () => {
  it('inlines a referenced image as a data:image/jpeg URI after the answer', async () => {
    const subject = {
      code: 'BIK-DBS',
      folderName: 'BIK-DBS - DB',
      title: 'Poznámky – BIK-DBS',
      files: [
        {
          fileLink: 'f1',
          fileName: 'Lecture 1',
          note: JSON.stringify({
            cards: [{ id: 'c1', question: 'Q', answer: 'A', collapsed: true, images: ['hashA'] }],
            notes: '',
          }),
        },
      ],
    };
    const lookup = async (h: string) => (h === 'hashA' ? 'AAAA' : null);
    const html = await renderSubjectNotesHtmlWithImages(subject, lookup);
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"');
  });

  it('omits images that fail to resolve, keeping the text', async () => {
    const subject = {
      code: 'X',
      folderName: 'X',
      title: 'X',
      files: [
        {
          fileLink: 'f',
          fileName: 'F',
          note: JSON.stringify({
            cards: [{ id: 'c', question: 'Q', answer: 'A', collapsed: true, images: ['gone'] }],
            notes: '',
          }),
        },
      ],
    };
    const html = await renderSubjectNotesHtmlWithImages(subject, async () => null);
    expect(html).toContain('Q');
    expect(html).not.toContain('data:image');
  });
});
