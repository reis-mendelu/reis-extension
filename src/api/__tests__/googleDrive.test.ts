import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../googleAuth', () => ({ getAccessToken: vi.fn().mockResolvedValue('tok') }));

import { uploadDoc, updateDocContent } from '../googleDrive';

describe('uploadDoc', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('POSTs multipart with the Google Docs target mimeType and returns the file', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ id: 'doc1', name: 'N' }), { status: 200 }),
        );
        const file = await uploadDoc('N', '<html><body><h1>x</h1></body></html>', ['parent1'], { reisNotesDoc: 'BIK-DBS' });
        expect(file.id).toBe('doc1');
        const body = fetchSpy.mock.calls[0][1]!.body as FormData;
        const meta = JSON.parse(await (body.get('metadata') as Blob).text());
        expect(meta.mimeType).toBe('application/vnd.google-apps.document');
        expect(meta.parents).toEqual(['parent1']);
        expect(meta.appProperties).toEqual({ reisNotesDoc: 'BIK-DBS' });
    });
});

describe('updateDocContent', () => {
    it('PATCHes the file content as HTML', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ id: 'doc1', name: 'N' }), { status: 200 }),
        );
        await updateDocContent('doc1', '<html><body><h1>y</h1></body></html>');
        const [url, init] = fetchSpy.mock.calls[0];
        expect(String(url)).toContain('/files/doc1');
        expect(init!.method).toBe('PATCH');
        expect((init!.headers as Record<string, string>)['Content-Type']).toContain('text/html');
    });
});
