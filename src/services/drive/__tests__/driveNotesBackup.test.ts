import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emptyManifest } from '../driveDiff';

const manifest = emptyManifest();
manifest.rootFolderId = 'root1';

vi.mock('../../../api/googleAuth', () => ({ isConnected: vi.fn().mockResolvedValue(true) }));
vi.mock('../driveManifest', () => ({
    loadManifest: vi.fn(async () => manifest),
    saveManifest: vi.fn(async () => {}),
}));
const drive = vi.hoisted(() => ({
    ensureFolder: vi.fn(async (name: string) => `folder-${name}`),
    findFileByProperty: vi.fn(async () => null),
    uploadDoc: vi.fn(async () => ({ id: 'doc1' })),
    updateDocContent: vi.fn(async () => ({ id: 'doc1' })),
    uploadFile: vi.fn(async () => ({ id: 'json1' })),
    updateFileContent: vi.fn(async () => ({ id: 'json1' })),
}));
vi.mock('../../../api/googleDrive', () => drive);

import { syncDriveNotesBackup } from '../driveNotesBackup';
import type { SubjectNotes } from '../notesDoc';

const subject: SubjectNotes = {
    code: 'BIK-DBS',
    folderName: 'BIK-DBS - Databases',
    title: 'Poznámky – BIK-DBS',
    files: [{ fileLink: '/x', fileName: 'L1.pdf', note: JSON.stringify([{ id: 'a', type: 'text', content: 'hi' }]) }],
};

describe('syncDriveNotesBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        manifest.notes = {};
    });

    it('creates a Doc + sidecar on first run and records them in the manifest', async () => {
        const r = await syncDriveNotesBackup([subject]);
        expect(drive.uploadDoc).toHaveBeenCalledTimes(1);
        expect(drive.uploadFile).toHaveBeenCalledTimes(1);
        expect(manifest.notes['BIK-DBS'].docId).toBe('doc1');
        expect(manifest.notes['BIK-DBS'].jsonId).toBe('json1');
        expect(r?.written).toBe(1);
    });

    it('skips a subject whose content hash is unchanged', async () => {
        await syncDriveNotesBackup([subject]); // first run records hash
        vi.clearAllMocks();
        const r = await syncDriveNotesBackup([subject]); // same content
        expect(drive.uploadDoc).not.toHaveBeenCalled();
        expect(drive.updateDocContent).not.toHaveBeenCalled();
        expect(r?.skipped).toBe(1);
    });

    it('skips a subject with no non-empty notes (never writes empty)', async () => {
        const empty: SubjectNotes = { ...subject, files: [{ fileLink: '/y', fileName: 'E.pdf', note: '  ' }] };
        const r = await syncDriveNotesBackup([empty]);
        expect(drive.uploadDoc).not.toHaveBeenCalled();
        expect(r?.skipped).toBe(1);
    });
});
