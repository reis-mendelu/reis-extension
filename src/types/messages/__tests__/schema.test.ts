import { describe, it, expect } from 'vitest';
import { Messages, IskamMessages } from '../../messages';
import { IframeToContentSchema, ContentToIframeSchema } from '../schema';

// The core guarantee: every message the app actually constructs must pass its
// schema. This is what protects us from an over-strict schema silently dropping
// valid IPC traffic (which would break the whole extension).
describe('message schemas accept every real factory message', () => {
    it('accepts all Content→Iframe messages the factory can build', () => {
        const msgs = [
            Messages.data('all', { lastSync: 1 }),
            Messages.data('exams', undefined, 'some error'),
            Messages.fetchResult('id-1', true, 'data'),
            Messages.fetchResult('id-2', false, undefined, 'err'),
            Messages.actionResult('id-3', true, { ok: true }),
            Messages.actionResult('id-4', false, undefined, 'err'),
            Messages.syncUpdate({ lastSync: 123, schedule: {}, isSyncing: false }),
            Messages.popupState(true),
            Messages.navMenu([{ id: 'a', label: 'A', children: [{ id: 'c', label: 'C', href: '/x' }] }]),
            Messages.telemetryError('Ctx.fn', new Error('boom')),
            IskamMessages.iskamSyncUpdate(null, false, null),
            IskamMessages.iskamSyncUpdate(null, true, 'auth'),
        ];
        for (const m of msgs) {
            const r = ContentToIframeSchema.safeParse(m);
            expect(r.success, `should accept ${m.type}`).toBe(true);
        }
    });

    it('accepts all Iframe→Content messages the factory can build', () => {
        const msgs = [
            Messages.ready(),
            Messages.requestData('schedule'),
            Messages.fetch('https://is.mendelu.cz/x', { method: 'GET' }),
            Messages.action('download_file', { fileId: 1 }),
            IskamMessages.iskamReady(),
        ];
        for (const m of msgs) {
            expect(IframeToContentSchema.safeParse(m).success, `should accept ${m.type}`).toBe(true);
        }
    });
});

describe('message schemas reject malformed input', () => {
    it('rejects unknown / missing type', () => {
        expect(ContentToIframeSchema.safeParse({ type: 'NOPE' }).success).toBe(false);
        expect(ContentToIframeSchema.safeParse({}).success).toBe(false);
        expect(ContentToIframeSchema.safeParse(null).success).toBe(false);
        expect(IframeToContentSchema.safeParse('a string').success).toBe(false);
    });

    it('rejects wrong-shaped payloads for a known type', () => {
        // REIS_FETCH with a non-string url must not pass.
        expect(IframeToContentSchema.safeParse({ type: 'REIS_FETCH', id: 'x', url: 42 }).success).toBe(false);
        // REIS_POPUP_STATE with non-boolean open.
        expect(ContentToIframeSchema.safeParse({ type: 'REIS_POPUP_STATE', open: 'yes' }).success).toBe(false);
        // REIS_ACTION with an unknown action enum value.
        expect(IframeToContentSchema.safeParse({ type: 'REIS_ACTION', id: 'x', action: 'rm_rf', payload: {} }).success).toBe(false);
    });
});
