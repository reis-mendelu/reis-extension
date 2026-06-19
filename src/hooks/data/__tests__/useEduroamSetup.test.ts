import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEduroamSetup } from '../useEduroamSetup';

vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: vi.fn().mockResolvedValue({
    rootCaDer: new Uint8Array(),
    clientP12: new Uint8Array(),
    password: 'pw123',
  }),
}));

vi.mock('../../../services/eduroam/mobileconfig', () => ({
  generateEduroamMobileconfig: vi.fn().mockReturnValue('<xml/>'),
}));

vi.mock('../../../api/eduroamTransfer', () => ({
  putTransfer: vi.fn().mockResolvedValue('tid'),
  buildTransferUrl: vi.fn().mockReturnValue('https://x/tid'),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,zz'),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('useEduroamSetup', () => {
  it('reset() clears generated state (status, qrDataUrl, password) after a successful run', async () => {
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.qrDataUrl).toBe('data:image/png;base64,zz');
    expect(result.current.password).toBe('pw123');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.qrDataUrl).toBeNull();
    expect(result.current.password).toBeNull();
  });
});
