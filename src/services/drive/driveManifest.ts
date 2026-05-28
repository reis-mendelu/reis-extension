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
const LOCK_KEY = 'reis_drive_lock';
/** A backup pass should never outlast this; a staler lock is treated as abandoned. */
const LOCK_TTL_MS = 15 * 60 * 1000;

/**
 * Best-effort cross-tab/cross-context mutex. The per-instance `running` guard
 * only serialises one content script; multiple IS Mendelu tabs each have their
 * own, so without this two passes could race-create duplicate folders. Returns
 * false if a fresh lock is already held.
 */
export async function acquireBackupLock(): Promise<boolean> {
    const res = await chrome.storage.local.get(LOCK_KEY);
    const heldAt = res[LOCK_KEY] as number | undefined;
    if (heldAt && Date.now() - heldAt < LOCK_TTL_MS) return false;
    await chrome.storage.local.set({ [LOCK_KEY]: Date.now() });
    return true;
}

export async function releaseBackupLock(): Promise<void> {
    await chrome.storage.local.remove(LOCK_KEY);
}

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
