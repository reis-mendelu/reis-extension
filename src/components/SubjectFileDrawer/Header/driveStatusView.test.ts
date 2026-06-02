import { describe, it, expect } from 'vitest';
import { classifyDriveStatus } from './driveStatusView';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function base(over: Partial<Parameters<typeof classifyDriveStatus>[0]> = {}) {
    return classifyDriveStatus({
        connected: true,
        syncing: false,
        failingSince: null,
        lastSync: NOW - 1000,
        now: NOW,
        ...over,
    });
}

describe('classifyDriveStatus', () => {
    it('invites connection when not linked', () => {
        expect(base({ connected: false })).toEqual({ kind: 'connect', tone: 'muted' });
    });

    it('shows syncing while a pass runs — even mid-failure-streak', () => {
        expect(base({ syncing: true, failingSince: NOW - 5 * DAY }))
            .toEqual({ kind: 'syncing', tone: 'muted' });
    });

    it('calls the very first pass first-sync, not a generic sync', () => {
        expect(base({ syncing: true, lastSync: 0 })).toEqual({ kind: 'first-sync', tone: 'muted' });
    });

    it('is healthy after a completed pass', () => {
        expect(base()).toEqual({ kind: 'healthy', tone: 'muted' });
    });

    it('is pending when linked but never backed up', () => {
        expect(base({ lastSync: 0 })).toEqual({ kind: 'pending', tone: 'muted' });
    });

    it('treats a fresh failure as a calm retry, not a catastrophe', () => {
        expect(base({ failingSince: NOW - HOUR() })).toEqual({ kind: 'retrying', tone: 'warning' });
    });

    it('escalates a day-old streak to a loud, reconnect-worthy error', () => {
        expect(base({ failingSince: NOW - DAY })).toEqual({ kind: 'broken', tone: 'error' });
        expect(base({ failingSince: NOW - 3 * DAY })).toEqual({ kind: 'broken', tone: 'error' });
    });
});

function HOUR() {
    return 60 * 60 * 1000;
}
