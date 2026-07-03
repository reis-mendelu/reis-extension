import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emptyManifest } from '../driveDiff';

const manifest = emptyManifest();
manifest.rootFolderId = 'root1';

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../../api/googleAuth', () => ({ isConnected: vi.fn().mockResolvedValue(true) }));
vi.mock('../driveManifest', () => ({
    loadManifest: vi.fn(async () => manifest),
    saveManifest: vi.fn(async () => {}),
    clearManifest: vi.fn(async () => {}),
    acquireBackupLock: vi.fn(async () => true),
    releaseBackupLock: vi.fn(async () => {}),
}));
const drive = vi.hoisted(() => ({
    ensureFolder: vi.fn(async (name: string) => `folder-${name}`),
    findFileByProperty: vi.fn(async () => null),
    uploadFile: vi.fn(async () => ({ id: 'f1', name: 'f' })),
    updateFileContent: vi.fn(async () => ({ id: 'f1', name: 'f' })),
    renameFile: vi.fn(async () => ({ id: 'f1', name: 'f' })),
    deleteFile: vi.fn(async () => {}),
    getFileLink: vi.fn(async () => null),
}));
vi.mock('../../../api/googleDrive', () => drive);
const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../../api/client', () => ({ fetchWithAuth }));

import { syncDriveBackup, type DriveBackupSubject } from '../driveBackup';

function subject(code: string, link: string): DriveBackupSubject {
    return {
        code,
        folderName: `${code} - Name`,
        files: [{ file_name: 'L1.pdf', date: '1. 1. 2026', subfolder: '', files: [{ name: 'L1.pdf', link, type: 'pdf' }] }] as never,
    };
}

describe('syncDriveBackup expired-session abort', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        manifest.files = {};
        manifest.folders = {};
        manifest.failingSince = null;
        manifest.lastError = null;
        fetchWithAuth.mockResolvedValue({
            url: 'https://is.mendelu.cz/auth/system/login.pl',
            headers: { get: () => 'text/html; charset=utf-8' },
            blob: async () => new Blob(['<!doctype html>']),
        });
    });

    it('aborts the whole pass on the first login-page response and never uploads', async () => {
        const r = await syncDriveBackup([subject('AAA', '/a'), subject('BBB', '/b')]);
        expect(fetchWithAuth).toHaveBeenCalledTimes(1); // BBB never fetched
        expect(drive.uploadFile).not.toHaveBeenCalled();
        expect(r?.failed).toBe(1);
        expect(r?.uploaded).toBe(0);
        expect(manifest.failingSince).toBeTruthy();
    });
});

describe('syncDriveBackup non-file (web-link / folder) row', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        manifest.files = {};
        manifest.folders = {};
        manifest.failingSince = null;
        manifest.lastError = null;
    });

    it('skips an HTML-page row at a non-login URL without aborting, failing, or tripping the warning', async () => {
        // AAA is a web-link/folder entry: 200 text/html at a normal IS URL.
        fetchWithAuth.mockResolvedValueOnce({
            url: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=123',
            headers: { get: () => 'text/html; charset=utf-8' },
            blob: async () => new Blob(['<!doctype html>']),
        });
        // BBB is a real binary attachment and must still be backed up.
        fetchWithAuth.mockResolvedValueOnce({
            url: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=1',
            headers: { get: () => 'application/pdf' },
            blob: async () => new Blob(['%PDF']),
        });

        const r = await syncDriveBackup([subject('AAA', '/a'), subject('BBB', '/b')]);

        expect(fetchWithAuth).toHaveBeenCalledTimes(2); // pass NOT aborted — BBB still fetched
        expect(drive.uploadFile).toHaveBeenCalledTimes(1); // only the real file uploaded
        expect(r?.failed).toBe(0); // non-file row is not a failure
        expect(r?.uploaded).toBe(1);
        expect(r?.skipped).toBe(1); // the web-link/folder row, skipped
        expect(manifest.failingSince).toBeNull(); // no permanent warning in the drawer
    });
});

describe('syncDriveBackup quarantine of a permanently-failing file', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        manifest.files = {};
        manifest.folders = {};
        manifest.fileFails = {};
        manifest.quarantined = 0;
        manifest.failingSince = null;
        manifest.lastError = null;
        // A genuinely broken IS download: the fetch keeps rejecting (not a login
        // page, not an HTML web-link row — a real, repeatable error).
        fetchWithAuth.mockRejectedValue(new Error('boom'));
    });

    it('keeps the failure as a calm retry for the first passes, then stops alarming once quarantined', async () => {
        const subj = [subject('AAA', '/x')];

        const r1 = await syncDriveBackup(subj);
        expect(r1?.failed).toBe(1);
        expect(r1?.quarantined).toBe(0);
        expect(manifest.failingSince).toBeTruthy(); // amber: will retry

        await syncDriveBackup(subj); // second miss — still a retry
        expect(manifest.quarantined).toBe(0);
        expect(manifest.failingSince).toBeTruthy();

        const r3 = await syncDriveBackup(subj); // third miss — now permanent
        expect(r3?.quarantined).toBe(1);
        expect(manifest.quarantined).toBe(1);
        expect(manifest.failingSince).toBeNull(); // no longer a live streak
        expect(manifest.lastError).toMatch(/can't be saved/);
    });
});

describe('syncDriveBackup rename-only pass (stale pre-fix Drive name)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        manifest.files = {};
        manifest.folders = { 'AAA - Name': 'folder-AAA - Name' };
        manifest.failingSince = null;
        manifest.lastError = null;
    });

    it('renames the Drive file in place, without re-fetching or re-uploading content, when only the computed name changed', async () => {
        // Same date as the subject's file (see subject() above), but the Drive
        // file still carries whatever name it was uploaded with before the
        // multi-attachment numbering / comment-folding fix existed.
        manifest.files['/a'] = { driveFileId: 'existingId', date: '1. 1. 2026', fileName: 'old-name.pdf' };

        const r = await syncDriveBackup([subject('AAA', '/a')]);

        expect(fetchWithAuth).not.toHaveBeenCalled();
        expect(drive.uploadFile).not.toHaveBeenCalled();
        expect(drive.updateFileContent).not.toHaveBeenCalled();
        expect(drive.renameFile).toHaveBeenCalledWith('existingId', 'L1.pdf');
        expect(r?.renamed).toBe(1);
        expect(manifest.files['/a']).toEqual({ driveFileId: 'existingId', date: '1. 1. 2026', fileName: 'L1.pdf' });
    });

    it('backfills the stored name for a manifest entry with none at all (files synced before name tracking existed)', async () => {
        manifest.files['/a'] = { driveFileId: 'existingId', date: '1. 1. 2026' };

        const r = await syncDriveBackup([subject('AAA', '/a')]);

        expect(drive.renameFile).toHaveBeenCalledWith('existingId', 'L1.pdf');
        expect(r?.renamed).toBe(1);
    });
});
