/**
 * useDriveBackup — Google Drive backup status for the UI.
 *
 * The backup runs in the content script and persists its manifest + tokens to
 * chrome.storage.local (shared with the iframe). We read that here and stay
 * reactive via chrome.storage.onChanged, so connecting/disconnecting or a
 * completed pass updates the UI without a reload.
 */

import { useCallback, useEffect, useState } from 'react';
import { loadManifest } from '../../services/drive/driveManifest';
import { isConnected } from '../../api/googleAuth';

export interface UseDriveBackupResult {
    /** Whether Google is linked (token present). null while first loading. */
    connected: boolean | null;
    /** webViewLink of the reIS root folder, once a backup has created it. */
    rootLink: string | null;
    /** Epoch ms of the last completed backup pass (0 = never). */
    lastSync: number;
    /** Number of files mirrored to Drive. */
    fileCount: number;
    /** Re-read status from storage. */
    refresh: () => Promise<void>;
}

const STORAGE_KEYS = ['reis_drive_manifest', 'reis_google_tokens'];

export function useDriveBackup(): UseDriveBackupResult {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [rootLink, setRootLink] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState(0);
    const [fileCount, setFileCount] = useState(0);

    const refresh = useCallback(async () => {
        const [linked, manifest] = await Promise.all([isConnected(), loadManifest()]);
        setConnected(linked);
        setRootLink(manifest.rootWebViewLink);
        setLastSync(manifest.lastSync);
        setFileCount(Object.keys(manifest.files).length);
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

    return { connected, rootLink, lastSync, fileCount, refresh };
}
