import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
}));

import { putTransfer, buildTransferUrl, RECEIVER_URL } from './eduroamTransfer';

describe('eduroamTransfer', () => {
  beforeEach(() => rpc.mockReset());

  it('uploads the profile bytes as base64 and returns the id', async () => {
    rpc.mockResolvedValue({ error: null });
    const id = await putTransfer(new Uint8Array([0x4d, 0x61, 0x6e]), 300);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rpc).toHaveBeenCalledWith('put_eduroam_transfer', {
      p_id: id,
      p_payload: 'TWFu', // base64("Man")
      p_ttl_seconds: 300,
    });
  });

  it('throws when the RPC returns an error', async () => {
    rpc.mockResolvedValue({ error: { message: 'rate limited' } });
    await expect(putTransfer(new Uint8Array([1]))).rejects.toThrow(/rate limited/);
  });

  it('builds the receiver URL with the transfer id', () => {
    expect(buildTransferUrl('abc-123')).toBe(`${RECEIVER_URL}?id=abc-123`);
  });
});
