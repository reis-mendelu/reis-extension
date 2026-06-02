/**
 * useDriveBackup — Google Drive backup status + connect/disconnect for the UI.
 *
 * The backup runs in the content script and persists its manifest + tokens to
 * chrome.storage.local (shared with the iframe). We read that here and stay
 * reactive via chrome.storage.onChanged, so connecting/disconnecting or a
 * completed pass updates the UI without a reload.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadManifest, clearManifest } from '../../services/drive/driveManifest';
import { isConnected, connectGoogle, disconnectGoogle, getConnectedEmail } from '../../api/googleAuth';
import { syncService } from '../../services/sync';

export interface UseDriveBackupResult {
    /** Whether Google is linked (token present). null while first loading. */
    connected: boolean | null;
    /** webViewLink of the reIS root folder, once a backup has created it. */
    rootLink: string | null;
    /**
     * Link to open in Drive: the current subject's folder when `courseCode` is
     * given and that folder exists, otherwise the reIS root.
     */
    folderLink: string | null;
    /** Epoch ms of the last completed backup pass (0 = never). */
    lastSync: number;
    /** Epoch ms the current failure streak began; null when the last pass was healthy. */
    failingSince: number | null;
    /** True while a backup pass is actively running. */
    syncing: boolean;
    /** Number of files mirrored to Drive. */
    fileCount: number;
    /** Files deemed permanently un-mirrorable (a broken IS download) — reported, not alarmed. */
    quarantined: number;
    /** Email of the connected Google account (null until known) — shows WHERE files go. */
    accountEmail: string | null;
    /** True while a connect/disconnect is in flight. */
    busy: boolean;
    /** Run the Google consent flow, then kick a sync so the first backup starts. */
    connect: () => Promise<void>;
    /** Unlink Google (stops future backups; leaves already-uploaded files in Drive). */
    disconnect: () => Promise<void>;
    /** Kick a backup now from cached listings (no full IS re-crawl). */
    backupNow: () => void;
    /** Re-read status from storage. */
    refresh: () => Promise<void>;
}

const STORAGE_KEYS = ['reis_drive_manifest', 'reis_google_tokens'];

export function useDriveBackup(courseCode?: string): UseDriveBackupResult {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [rootLink, setRootLink] = useState<string | null>(null);
    const [folders, setFolders] = useState<Record<string, string>>({});
    const [lastSync, setLastSync] = useState(0);
    const [failingSince, setFailingSince] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [fileCount, setFileCount] = useState(0);
    const [quarantined, setQuarantined] = useState(0);
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        const [linked, manifest, email] = await Promise.all([isConnected(), loadManifest(), getConnectedEmail()]);
        setConnected(linked);
        setAccountEmail(email);
        setRootLink(manifest.rootWebViewLink);
        setFolders(manifest.folders);
        setLastSync(manifest.lastSync);
        setFailingSince(manifest.failingSince);
        setSyncing(manifest.syncing);
        setFileCount(Object.keys(manifest.files).length);
        setQuarantined(manifest.quarantined ?? 0);
    }, []);

    // The subject folder is the top-level manifest folder named "<CODE> - …".
    // Build its Drive URL from the stored id; fall back to the reIS root.
    const folderLink = useMemo(() => {
        if (courseCode) {
            const key = Object.keys(folders).find((k) => !k.includes('/') && k.startsWith(`${courseCode} -`));
            if (key) return `https://drive.google.com/drive/folders/${folders[key]}`;
        }
        return rootLink;
    }, [courseCode, folders, rootLink]);

    const connect = useCallback(async () => {
        setBusy(true);
        try {
            await connectGoogle();
            syncService.triggerDriveBackup(); // back up now from cached listings, no full re-crawl
        } finally {
            await refresh();
            setBusy(false);
        }
    }, [refresh]);

    const disconnect = useCallback(async () => {
        setBusy(true);
        try {
            await disconnectGoogle();
            // Drop the manifest too: it caches folder/file ids tied to the
            // just-unlinked account. A reconnect with the SAME account re-heals
            // for free via the appProperties reuse path (no re-upload); a
            // DIFFERENT account would otherwise point at unreachable ids.
            await clearManifest();
        } finally {
            await refresh();
            setBusy(false);
        }
    }, [refresh]);

    const backupNow = useCallback(() => {
        // Optimistic spinner: the manifest's syncing flag follows once the
        // content script picks up the message, but reflect intent immediately
        // so the click never feels dead.
        setSyncing(true);
        syncService.triggerDriveBackup();
    }, []);

    useEffect(() => {
        refresh();
        if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
        const onChanged = (changes: Record<string, unknown>, area: string) => {
            if (area === 'local' && STORAGE_KEYS.some((k) => k in changes)) refresh();
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, [refresh]);

    return { connected, rootLink, folderLink, lastSync, failingSince, syncing, fileCount, quarantined, accountEmail, busy, connect, disconnect, backupNow, refresh };
}
