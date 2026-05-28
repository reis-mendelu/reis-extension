import { describe, it, expect } from 'vitest';
import type { ParsedFile } from '../../types/documents';
import { flattenSubjectFiles, diffManifest, emptyManifest, folderKey, linkHash } from './driveDiff';

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
