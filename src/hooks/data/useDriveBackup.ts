/**
 * useDriveBackup — Google Drive backup status + connect/disconnect for the UI.
 *
 * The backup runs in the content script and persists its manifest + tokens to
 * chrome.storage.local (shared with the iframe). We read that here and stay
 * reactive via chrome.storage.onChanged, so connecting/disconnecting or a
 * completed pass updates the UI without a reload.
 */

import { useCallback, useEffect, useState } from 'react';
import { loadManifest, clearManifest } from '../../services/drive/driveManifest';
import { isConnected, connectGoogle, disconnectGoogle } from '../../api/googleAuth';
import { syncService } from '../../services/sync';

export interface UseDriveBackupResult {
    /** Whether Google is linked (token present). null while first loading. */
    connected: boolean | null;
    /** webViewLink of the reIS root folder, once a backup has created it. */
    rootLink: string | null;
    /** Epoch ms of the last completed backup pass (0 = never). */
    lastSync: number;
    /** Epoch ms the current failure streak began; null when the last pass was healthy. */
    failingSince: number | null;
    /** Number of files mirrored to Drive. */
    fileCount: number;
    /** True while a connect/disconnect is in flight. */
    busy: boolean;
    /** Run the Google consent flow, then kick a sync so the first backup starts. */
    connect: () => Promise<void>;
    /** Unlink Google (stops future backups; leaves already-uploaded files in Drive). */
    disconnect: () => Promise<void>;
    /** Re-read status from storage. */
    refresh: () => Promise<void>;
}

const STORAGE_KEYS = ['reis_drive_manifest', 'reis_google_tokens'];

export function useDriveBackup(): UseDriveBackupResult {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [rootLink, setRootLink] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState(0);
    const [failingSince, setFailingSince] = useState<number | null>(null);
    const [fileCount, setFileCount] = useState(0);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        const [linked, manifest] = await Promise.all([isConnected(), loadManifest()]);
        setConnected(linked);
        setRootLink(manifest.rootWebViewLink);
        setLastSync(manifest.lastSync);
        setFailingSince(manifest.failingSince);
        setFileCount(Object.keys(manifest.files).length);
    }, []);

    const connect = useCallback(async () => {
        setBusy(true);
        try {
            await connectGoogle();
            syncService.triggerSync(); // start the first backup immediately
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

    useEffect(() => {
        refresh();
        if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
        const onChanged = (changes: Record<string, unknown>, area: string) => {
            if (area === 'local' && STORAGE_KEYS.some((k) => k in changes)) refresh();
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, [refresh]);

    return { connected, rootLink, lastSync, failingSince, fileCount, busy, connect, disconnect, refresh };
}
