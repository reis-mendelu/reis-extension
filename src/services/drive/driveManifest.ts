/**
 * Persistence for the Drive backup manifest in chrome.storage.local.
 *
 * Lives in extension storage (not IndexedDB) because the backup runs in the
 * content-script context, which has a different-origin IndexedDB than the
 * iframe. chrome.storage.local is shared across both, and the extension holds
 * the `unlimitedStorage` permission.
 */

import { emptyManifest, type DriveManifest } from './driveDiff';

const KEY = 'reis_drive_manifest';

export async function loadManifest(): Promise<DriveManifest> {
    const res = await chrome.storage.local.get(KEY);
    return (res[KEY] as DriveManifest) ?? emptyManifest();
}

export async function saveManifest(manifest: DriveManifest): Promise<void> {
    await chrome.storage.local.set({ [KEY]: manifest });
}

export async function clearManifest(): Promise<void> {
    await chrome.storage.local.remove(KEY);
}
