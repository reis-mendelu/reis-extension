import { describe, it, expect, afterEach } from 'vitest';
import {
    broadcastFilesUpdate,
    FILES_SYNC_CHANNEL,
    __resetFilesBroadcastChannel,
    type FilesSyncMessage,
} from '../broadcastFilesSync';

afterEach(() => __resetFilesBroadcastChannel());

describe('broadcastFilesUpdate', () => {
    it('delivers the message on the FILES_SYNC_CHANNEL', async () => {
        const received: FilesSyncMessage[] = [];
        const listener = new BroadcastChannel(FILES_SYNC_CHANNEL);
        listener.onmessage = (event) => received.push(event.data as FilesSyncMessage);

        broadcastFilesUpdate({ courseCode: 'ALG', fetchedAt: 1700000000000 });

        // BroadcastChannel delivery is async — let the event loop turn.
        await new Promise((r) => setTimeout(r, 10));
        listener.close();

        expect(received).toEqual([{ courseCode: 'ALG', fetchedAt: 1700000000000 }]);
    });

    it('does not throw when called repeatedly', () => {
        expect(() => {
            broadcastFilesUpdate({ courseCode: 'A', fetchedAt: 1 });
            broadcastFilesUpdate({ courseCode: 'B', fetchedAt: 2 });
            broadcastFilesUpdate({ courseCode: 'C', fetchedAt: 3 });
        }).not.toThrow();
    });
});
