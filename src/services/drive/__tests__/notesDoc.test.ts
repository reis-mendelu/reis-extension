import { describe, it, expect } from 'vitest';
import {
    renderSubjectNotesHtml,
    serializeSubjectNotesJson,
    notesContentHash,
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
    it('renders title, one-way banner, file heading and blocks, escaping HTML', () => {
        const html = renderSubjectNotesHtml(subject);
        expect(html).toContain('<h1>Poznámky – BIK-DBS</h1>');
        expect(html).toContain('not saved back'); // one-way banner
        expect(html).toContain('<h2>Lecture 1.pdf</h2>');
        expect(html).toContain('<h3>Normalization</h3>');
        expect(html).toContain('Reduce &lt;redundancy&gt; &amp; anomalies'); // escaped
        expect(html).toContain('<b>What is 3NF?</b>');
        expect(html).toContain('No transitive deps');
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
        expect(json.files[0].note).toBe(subject.files[0].note); // verbatim
    });
});

describe('notesContentHash', () => {
    it('is stable for identical content and differs when content changes', async () => {
        const a = await notesContentHash(serializeSubjectNotesJson(subject));
        const b = await notesContentHash(serializeSubjectNotesJson(subject));
        expect(a).toBe(b);
        const changed = await notesContentHash(serializeSubjectNotesJson({
            ...subject,
            files: [{ ...subject.files[0], note: '[]' }],
        }));
        expect(changed).not.toBe(a);
    });
});
