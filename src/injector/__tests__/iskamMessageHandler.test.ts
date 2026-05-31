import { describe, it, expect, beforeEach, vi } from 'vitest';

const { contentWindow } = vi.hoisted(() => ({ contentWindow: {} as Window }));

vi.mock('../iskamInjector', () => ({
    iskamIframeElement: { contentWindow },
    markIskamIframeReady: vi.fn(),
    sendToIskamIframe: vi.fn(),
}));

// Simulate a session where the initial sync already completed: cached data is
// present and no sync is in flight (the queue the iframe would have drained is
// long gone — a reload must be re-seeded from this cache).
vi.mock('../iskamSyncService', () => ({
    cachedIskamData: { profile: { name: 'X' } },
    isSyncingIskam: false,
}));

import { handleIskamMessage } from '../iskamMessageHandler';
import { sendToIskamIframe, markIskamIframeReady, iskamIframeElement } from '../iskamInjector';

function readyEvent(): MessageEvent {
    return {
        origin: 'chrome-extension://test-extension-id',
        source: iskamIframeElement!.contentWindow,
        data: { type: 'ISKAM_READY' },
    } as MessageEvent;
}

describe('handleIskamMessage — ISKAM_READY', () => {
    beforeEach(() => vi.clearAllMocks());

    it('flushes the queue and re-sends current cached state (reloaded iframe must not be stuck on stale IDB)', async () => {
        await handleIskamMessage(readyEvent());
        expect(markIskamIframeReady).toHaveBeenCalledTimes(1);
        expect(sendToIskamIframe).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'ISKAM_SYNC_UPDATE',
                data: expect.objectContaining({ iskamData: { profile: { name: 'X' } }, isSyncing: false }),
            }),
        );
    });

    it('ignores messages from a foreign origin', async () => {
        const evt = { ...readyEvent(), origin: 'https://evil.example' } as MessageEvent;
        await handleIskamMessage(evt);
        expect(markIskamIframeReady).not.toHaveBeenCalled();
    });
});
