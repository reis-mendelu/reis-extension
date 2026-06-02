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
/** Window we give a racing writer's set to land before confirming ownership. */
const LOCK_SETTLE_MS = 50;

interface LockRecord { token: string; at: number; }

/** Token of the lock this context currently holds, so release can verify ownership. */
let heldToken: string | null = null;

function lockAge(rec: LockRecord | number | undefined): number | undefined {
    // Tolerate a legacy numeric lock written by a previous extension version.
    const at = typeof rec === 'number' ? rec : rec?.at;
    return at === undefined ? undefined : Date.now() - at;
}

/**
 * Best-effort cross-tab/cross-context mutex. The per-instance `running` guard
 * only serialises one content script; multiple IS Mendelu tabs each have their
 * own, so without this two passes could race-create duplicate folders.
 *
 * chrome.storage has no compare-and-swap, so we write a unique token, let a
 * racing writer's set land, then read back and only win if our token survived.
 * Returns false if a fresh lock is already held or we lost the race.
 */
export async function acquireBackupLock(): Promise<boolean> {
    const existing = (await chrome.storage.local.get(LOCK_KEY))[LOCK_KEY] as LockRecord | number | undefined;
    const age = lockAge(existing);
    if (age !== undefined && age < LOCK_TTL_MS) return false;

    const token = `${Date.now()}-${crypto.randomUUID()}`;
    await chrome.storage.local.set({ [LOCK_KEY]: { token, at: Date.now() } satisfies LockRecord });
    await new Promise((r) => setTimeout(r, LOCK_SETTLE_MS));
    const winner = (await chrome.storage.local.get(LOCK_KEY))[LOCK_KEY] as LockRecord | undefined;
    if (winner?.token !== token) return false;
    heldToken = token;
    return true;
}

export async function releaseBackupLock(): Promise<void> {
    // Only remove the lock if we still own it — never clobber a lock another
    // context legitimately took over after ours expired by TTL.
    const current = (await chrome.storage.local.get(LOCK_KEY))[LOCK_KEY] as LockRecord | undefined;
    if (current?.token === heldToken) {
        await chrome.storage.local.remove(LOCK_KEY);
    }
    heldToken = null;
}

export async function loadManifest(): Promise<DriveManifest> {
    const res = await chrome.storage.local.get(KEY);
    const stored = res[KEY] as DriveManifest | undefined;
    // Merge over defaults so a manifest written by an older version gains any
    // newly-added fields (e.g. fileFails/quarantined) instead of arriving undefined.
    return stored ? { ...emptyManifest(), ...stored } : emptyManifest();
}

export async function saveManifest(manifest: DriveManifest): Promise<void> {
    await chrome.storage.local.set({ [KEY]: manifest });
}

export async function clearManifest(): Promise<void> {
    await chrome.storage.local.remove(KEY);
}
