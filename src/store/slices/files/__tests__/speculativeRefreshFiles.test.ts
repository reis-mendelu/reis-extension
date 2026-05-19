import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    speculativeRefreshFilesImpl,
    SPECULATIVE_STALE_MS,
    __resetSpeculativeState,
} from '../speculativeRefreshFiles';

beforeEach(() => __resetSpeculativeState());

const NOW = 1_700_000_000_000;

describe('speculativeRefreshFilesImpl', () => {
    it('fires refresh when cache is cold', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = speculativeRefreshFilesImpl({
            courseCode: 'ALG',
            lastFilesFetchedAt: {},
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toBe(true);
        expect(refresh).toHaveBeenCalledWith('ALG');
    });

    it('skips if last fetch is within SPECULATIVE_STALE_MS', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = speculativeRefreshFilesImpl({
            courseCode: 'ALG',
            lastFilesFetchedAt: { ALG: NOW - 1000 },
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toBe(false);
        expect(refresh).not.toHaveBeenCalled();
    });

    it('does not skip if last fetch is older than SPECULATIVE_STALE_MS', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = speculativeRefreshFilesImpl({
            courseCode: 'ALG',
            lastFilesFetchedAt: { ALG: NOW - SPECULATIVE_STALE_MS - 1 },
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toBe(true);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('skips when subject is already loading', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = speculativeRefreshFilesImpl({
            courseCode: 'ALG',
            lastFilesFetchedAt: {},
            filesLoading: { ALG: true },
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toBe(false);
        expect(refresh).not.toHaveBeenCalled();
    });

    it('enforces single in-flight: second call is dropped while first is pending', async () => {
        let resolveFirst: () => void;
        const firstPromise = new Promise<void>((r) => { resolveFirst = r; });
        const refresh = vi.fn()
            .mockReturnValueOnce(firstPromise)
            .mockResolvedValue(undefined);

        const firedA = speculativeRefreshFilesImpl({
            courseCode: 'ALG',
            lastFilesFetchedAt: {},
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(firedA).toBe(true);

        const firedB = speculativeRefreshFilesImpl({
            courseCode: 'BIO',
            lastFilesFetchedAt: {},
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(firedB).toBe(false);
        expect(refresh).toHaveBeenCalledTimes(1);

        // Resolve first → drain microtasks so .finally() releases the token.
        resolveFirst!();
        await firstPromise;
        await new Promise((r) => setTimeout(r, 0));

        const firedC = speculativeRefreshFilesImpl({
            courseCode: 'BIO',
            lastFilesFetchedAt: {},
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(firedC).toBe(true);
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('releases the in-flight token after rejection', async () => {
        const refresh = vi.fn().mockRejectedValueOnce(new Error('boom'));
        const firedA = speculativeRefreshFilesImpl({
            courseCode: 'ALG',
            lastFilesFetchedAt: {},
            filesLoading: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(firedA).toBe(true);

        // Wait a microtask cycle so the .finally() handler runs.
        await new Promise((r) => setTimeout(r, 0));

        const okRefresh = vi.fn().mockResolvedValue(undefined);
        const firedB = speculativeRefreshFilesImpl({
            courseCode: 'BIO',
            lastFilesFetchedAt: {},
            filesLoading: {},
            refreshFilesForSubject: okRefresh,
            now: NOW,
        });
        expect(firedB).toBe(true);
    });
});
