import { describe, it, expect } from 'vitest';
import type { ParsedFile } from '../../types/documents';
import { flattenSubjectFiles, diffManifest, emptyManifest, folderKey, linkHash, buildDriveFileName } from './driveDiff';

function pf(partial: Partial<ParsedFile>): ParsedFile {
    return {
        subfolder: '',
        file_name: 'f',
        file_comment: '',
        author: '',
        date: '',
        files: [],
        ...partial,
    };
}

describe('flattenSubjectFiles', () => {
    it('puts a file with a subfolder under subject/subfolder', () => {
        const items = flattenSubjectFiles('BIK-DBS - Databases', [
            pf({ subfolder: 'Lectures', date: '2026-03-01', files: [{ name: 'l1.pdf', type: 'pdf', link: 'L1' }] }),
        ]);
        expect(items).toEqual([
            { isLink: 'L1', fileName: 'l1.pdf', date: '2026-03-01', pathSegments: ['BIK-DBS - Databases', 'Lectures'] },
        ]);
    });

    it('puts a file with no subfolder directly under the subject', () => {
        const items = flattenSubjectFiles('SUB', [
            pf({ subfolder: '', files: [{ name: 'a.pdf', type: 'pdf', link: 'A' }] }),
        ]);
        expect(items[0].pathSegments).toEqual(['SUB']);
    });

    it('emits one item per attachment in a group', () => {
        const items = flattenSubjectFiles('SUB', [
            pf({ files: [{ name: 'a', type: 'pdf', link: 'A' }, { name: 'b', type: 'pdf', link: 'B' }] }),
        ]);
        expect(items.map((i) => i.isLink)).toEqual(['A', 'B']);
    });

    it('skips attachments with no link and groups with no files', () => {
        const items = flattenSubjectFiles('SUB', [
            pf({ files: [] }),
            pf({ files: [{ name: 'x', type: 'pdf', link: '' }] }),
            pf({ files: [{ name: 'ok', type: 'pdf', link: 'OK' }] }),
        ]);
        expect(items.map((i) => i.isLink)).toEqual(['OK']);
    });

    it('folds the teacher comment into the Drive file name (teachers use it as the title)', () => {
        const items = flattenSubjectFiles('SUB', [
            pf({ file_name: 'dokument', file_comment: 'Přednáška 5 – Normalizace', files: [{ name: 'dokument', type: 'pdf', link: 'L' }] }),
        ]);
        expect(items[0].fileName).toBe('dokument — Přednáška 5 – Normalizace');
    });

    it('keeps the bare name when there is no comment', () => {
        const items = flattenSubjectFiles('SUB', [
            pf({ file_name: 'slides.pdf', file_comment: '', files: [{ name: 'slides.pdf', type: 'pdf', link: 'L' }] }),
        ]);
        expect(items[0].fileName).toBe('slides.pdf');
    });
});

describe('buildDriveFileName', () => {
    it('returns just the name when no comment is present', () => {
        expect(buildDriveFileName('slides.pdf', '')).toBe('slides.pdf');
        expect(buildDriveFileName('slides.pdf')).toBe('slides.pdf');
    });

    it('joins name and comment with an em dash', () => {
        expect(buildDriveFileName('dokument', 'Lecture 5')).toBe('dokument — Lecture 5');
    });

    it('does not duplicate when the comment equals the name (case-insensitive)', () => {
        expect(buildDriveFileName('Lecture 5', 'lecture 5')).toBe('Lecture 5');
    });

    it('falls back to the comment when the name is empty', () => {
        expect(buildDriveFileName('', 'Only the comment')).toBe('Only the comment');
    });

    it('strips characters that break Drive desktop sync and collapses whitespace', () => {
        expect(buildDriveFileName('a/b:c', 'note\nwith   gaps')).toBe('a b c — note with gaps');
    });

    it('clamps absurdly long names', () => {
        const long = 'x'.repeat(500);
        expect(buildDriveFileName('doc', long).length).toBeLessThanOrEqual(200);
    });

    it('never returns an empty string', () => {
        expect(buildDriveFileName('', '')).toBe('soubor');
    });
});

describe('diffManifest', () => {
    const items = flattenSubjectFiles('SUB', [
        pf({ date: 'd1', files: [{ name: 'a', type: 'pdf', link: 'A' }] }),
        pf({ date: 'd1', files: [{ name: 'b', type: 'pdf', link: 'B' }] }),
    ]);

    it('marks everything as create against an empty manifest', () => {
        const d = diffManifest(items, emptyManifest());
        expect(d.create.map((i) => i.isLink)).toEqual(['A', 'B']);
        expect(d.update).toEqual([]);
        expect(d.skip).toBe(0);
    });

    it('skips files whose date is unchanged', () => {
        const m = emptyManifest();
        m.files['A'] = { driveFileId: 'drvA', date: 'd1' };
        const d = diffManifest(items, m);
        expect(d.skip).toBe(1);
        expect(d.create.map((i) => i.isLink)).toEqual(['B']);
    });

    it('marks a file for update when its date changed, carrying the existing Drive id', () => {
        const m = emptyManifest();
        m.files['A'] = { driveFileId: 'drvA', date: 'OLD' };
        const d = diffManifest(items, m);
        expect(d.update).toEqual([{ item: items[0], driveFileId: 'drvA' }]);
        expect(d.create.map((i) => i.isLink)).toEqual(['B']);
    });
});

describe('folderKey', () => {
    it('joins segments with a slash', () => {
        expect(folderKey(['SUB', 'Lectures'])).toBe('SUB/Lectures');
    });
});

describe('linkHash', () => {
    it('is a stable 24-char hex string', async () => {
        const h = await linkHash('https://is.mendelu.cz/auth/dok_server/slozka.pl?id=123;download=456');
        expect(h).toMatch(/^[0-9a-f]{24}$/);
        expect(await linkHash('https://is.mendelu.cz/auth/dok_server/slozka.pl?id=123;download=456')).toBe(h);
    });

    it('differs for different links — distinct files never collide on the dedup key', async () => {
        expect(await linkHash('A')).not.toBe(await linkHash('B'));
    });
});
