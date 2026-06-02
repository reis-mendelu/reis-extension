import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncUpdateMessage } from '../../types/messages';

vi.mock('../iframeManager', () => ({ sendToIframe: vi.fn() }));

import { sendToIframe } from '../iframeManager';
import { emitScheduleFirst } from '../syncService';

describe('emitScheduleFirst', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sends a schedule-only REIS_SYNC_UPDATE with isSyncing true', () => {
        const schedule = [{ id: 'x' }];
        emitScheduleFirst(schedule, 1234);
        expect(sendToIframe).toHaveBeenCalledTimes(1);
        const msg = vi.mocked(sendToIframe).mock.calls[0][0] as SyncUpdateMessage;
        expect(msg.type).toBe('REIS_SYNC_UPDATE');
        expect(msg.data.schedule).toBe(schedule);
        expect(msg.data.isSyncing).toBe(true);
        expect(msg.data.lastSync).toBe(1234);
        expect(msg.data.subjects).toBeUndefined();
        expect(msg.data.exams).toBeUndefined();
    });

    it('does not emit when schedule is empty', () => {
        emitScheduleFirst([], 1234);
        expect(sendToIframe).not.toHaveBeenCalled();
    });
});
