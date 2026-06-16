import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
}));

import { putTransfer, buildTransferUrl, RECEIVER_URL } from './eduroamTransfer';

describe('eduroamTransfer', () => {
  beforeEach(() => rpc.mockReset());

  it('uploads the payload as base64 via put_eduroam_transfer', async () => {
    rpc.mockResolvedValue({ error: null });
    await putTransfer('the-id', new Uint8Array([0x4d, 0x61, 0x6e]), 300);
    expect(rpc).toHaveBeenCalledWith('put_eduroam_transfer', {
      p_id: 'the-id',
      p_payload: 'TWFu', // base64("Man")
      p_ttl_seconds: 300,
    });
  });

  it('throws when the RPC returns an error', async () => {
    rpc.mockResolvedValue({ error: { message: 'rate limited' } });
    await expect(putTransfer('x', new Uint8Array([1]))).rejects.toThrow(/rate limited/);
  });

  it('puts the key only in the URL fragment, never the query', () => {
    const url = buildTransferUrl('abc-123', 'KEYB64URL');
    expect(url).toBe(`${RECEIVER_URL}?id=abc-123#KEYB64URL`);
    expect(url.split('#')[0]).not.toContain('KEYB64URL');
  });
});
