import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emptyManifest } from '../driveDiff';

const manifest = emptyManifest();
manifest.rootFolderId = 'root1';

vi.mock('../../../api/googleAuth', () => ({ isConnected: vi.fn().mockResolvedValue(true) }));
const lock = vi.hoisted(() => ({
    acquireBackupLock: vi.fn(async () => true),
    releaseBackupLock: vi.fn(async () => {}),
}));
vi.mock('../driveManifest', () => ({
    loadManifest: vi.fn(async () => manifest),
    saveManifest: vi.fn(async () => {}),
    acquireBackupLock: lock.acquireBackupLock,
    releaseBackupLock: lock.releaseBackupLock,
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
import { notesContentHash, serializeEmptyNotesJson } from '../notesDoc';

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

describe('syncDriveNotesBackup deletion reconcile', () => {
    beforeEach(() => { vi.clearAllMocks(); manifest.notes = {}; });

    it('empties a subject in place when its only note is deleted', async () => {
        manifest.notes['BIK-DBS'] = { docId: 'doc1', docHash: 'old', jsonId: 'json1' };
        const emptied = { ...subject, files: [{ fileLink: '/x', fileName: 'L1.pdf', note: '' }] };
        const r = await syncDriveNotesBackup([emptied]);
        expect(drive.uploadDoc).not.toHaveBeenCalled();
        expect(drive.updateDocContent).toHaveBeenCalledWith('doc1', expect.any(String));
        expect(drive.updateFileContent).toHaveBeenCalledWith('json1', expect.anything());
        const emptyHash = await notesContentHash(serializeEmptyNotesJson('BIK-DBS'));
        expect(manifest.notes['BIK-DBS'].docHash).toBe(emptyHash);
        expect(r?.cleared).toBe(1);
    });

    it('empties an orphan present in the manifest but absent from the snapshot', async () => {
        manifest.notes['OLD'] = { docId: 'docO', docHash: 'x', jsonId: 'jsonO' };
        const r = await syncDriveNotesBackup([]);
        expect(drive.updateDocContent).toHaveBeenCalledWith('docO', expect.any(String));
        expect(drive.updateFileContent).toHaveBeenCalledWith('jsonO', expect.anything());
        expect(r?.cleared).toBe(1);
    });

    it('does not re-empty an already-empty subject (idempotent)', async () => {
        const emptyHash = await notesContentHash(serializeEmptyNotesJson('OLD'));
        manifest.notes['OLD'] = { docId: 'docO', docHash: emptyHash, jsonId: 'jsonO' };
        const r = await syncDriveNotesBackup([]);
        expect(drive.updateDocContent).not.toHaveBeenCalled();
        expect(r?.cleared).toBe(0);
    });
});

describe('syncDriveNotesBackup locking', () => {
    beforeEach(() => { vi.clearAllMocks(); manifest.notes = {}; });

    it('skips entirely when the backup lock is held', async () => {
        lock.acquireBackupLock.mockResolvedValueOnce(false);
        const r = await syncDriveNotesBackup([subject]);
        expect(r).toBeNull();
        expect(drive.uploadDoc).not.toHaveBeenCalled();
    });

    it('releases the lock after a normal run', async () => {
        await syncDriveNotesBackup([subject]);
        expect(lock.releaseBackupLock).toHaveBeenCalledTimes(1);
    });
});
