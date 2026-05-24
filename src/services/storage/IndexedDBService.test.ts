/**
 * Tests for IndexedDBService connection self-healing.
 *
 * Production telemetry shows a chronic cluster of
 * "Failed to execute 'transaction' on 'IDBDatabase': The database connection
 * is closing." errors across many slices. Root cause: the singleton caches one
 * connection forever and never reopens when the browser closes it (another tab
 * upgrades the DB, the extension context is invalidated, or an idle connection
 * is reaped). These tests pin the self-healing behavior.
 */

import { describe, it, expect } from 'vitest';
import { IndexedDBService } from './IndexedDBService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = IndexedDBService as any;

describe('IndexedDBService self-healing', () => {
    it('reopens for writes after the connection is closed', async () => {
        await IndexedDBService.set('meta', 'vc_token', { first: true });

        // Close the live handle, then write through the service. The write path
        // (set) must reopen rather than fail against the dead connection.
        const db = await internal.getDB();
        db.close();

        await IndexedDBService.set('meta', 'vc_token', { second: true });
        const result = await IndexedDBService.get('meta', 'vc_token');
        expect(result).toEqual({ second: true });
    });

    it('serves repeated operations after a close (handle is durably restored)', async () => {
        const db = await internal.getDB();
        db.close();

        await IndexedDBService.set('meta', 'a', { v: 1 });
        await IndexedDBService.set('meta', 'b', { v: 2 });
        expect(await IndexedDBService.get('meta', 'a')).toEqual({ v: 1 });
        expect(await IndexedDBService.get('meta', 'b')).toEqual({ v: 2 });
    });

    it('retries an operation that fails because the connection is closing', async () => {
        await IndexedDBService.set('meta', 'closing_token', { n: 2 });

        // Hard-close the live handle so the next op on it throws
        // InvalidStateError ("connection is closing"). run() must catch,
        // reopen, and retry once.
        const db = await internal.getDB();
        db.close();

        const result = await IndexedDBService.get('meta', 'closing_token');
        expect(result).toEqual({ n: 2 });
    });
});
