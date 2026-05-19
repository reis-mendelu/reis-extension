export const FILES_SYNC_CHANNEL = 'reis_files_sync';

export interface FilesSyncMessage {
    courseCode: string;
    fetchedAt: number;
}

let postChannel: BroadcastChannel | null = null;

function getPostChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!postChannel) postChannel = new BroadcastChannel(FILES_SYNC_CHANNEL);
    return postChannel;
}

/**
 * Notify other reIS iframes (different windows or tabs) that a subject's files
 * have just been refreshed and persisted to IDB. Receivers rehydrate from IDB.
 * Fire-and-forget; safe to call from any context where BroadcastChannel exists.
 */
export function broadcastFilesUpdate(message: FilesSyncMessage): void {
    try {
        getPostChannel()?.postMessage(message);
    } catch {
        // Swallow — some test environments throw on closed channels.
    }
}

export function __resetFilesBroadcastChannel(): void {
    postChannel?.close();
    postChannel = null;
}
