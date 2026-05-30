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
