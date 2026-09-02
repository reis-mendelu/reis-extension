import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { saveAs } from 'file-saver';
import { useEduroamSetup } from '../useEduroamSetup';

vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: vi.fn().mockResolvedValue({
    rootCaDer: new Uint8Array(),
    clientP12: new Uint8Array(),
    password: 'pw123',
  }),
  fetchEduroamPassword: vi.fn().mockResolvedValue('pw123'),
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

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('../../../services/eduroam/eapConfig', () => ({
  generateEapConfig: vi.fn().mockReturnValue('<eap-config/>'),
}));

// Only the native wiring is stubbed; configureEduroam itself runs for real, so
// these tests cover the result-code mapping the student actually sees.
vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(false),
  nativeEduroamDeps: { configure: vi.fn() },
}));

/** Put the hook on the phone, with the plugin answering `perNetwork`. */
async function onPhone(perNetwork: string, resultCode = -1) {
  const native = await import('../../../mobile/eduroamNative');
  vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(true);
  vi.mocked(native.nativeEduroamDeps.configure).mockResolvedValue({ resultCode, perNetwork });
  return native;
}

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

  it('autoSelectTarget prefetches the password for the given target exactly once on mount', async () => {
    const { fetchEduroamPassword } = await import('../../../api/eduroam');
    const { result } = renderHook(({ target }) => useEduroamSetup(target), {
      initialProps: { target: 'ios' as const },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchEduroamPassword).toHaveBeenCalledTimes(1);
    expect(result.current.password).toBe('pw123');
  });

  it("run('windows') saves a .eap-config file directly (no QR, no transfer)", async () => {
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('windows');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.password).toBe('pw123');
    expect(result.current.qrDataUrl).toBeNull();
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'eduroam-reis.eap-config');
  });

  it('configures the network natively on the phone, with no QR and no transfer', async () => {
    const { putTransfer } = await import('../../../api/eduroamTransfer');
    await onPhone('0');
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.outcome).toBe('saved');
    // A QR on the very device being configured is unscannable — it is a
    // desktop→phone artifact and has no meaning here.
    expect(result.current.qrDataUrl).toBeNull();
    expect(putTransfer).not.toHaveBeenCalled();
  });

  it('treats an eduroam network that already exists as success', async () => {
    await onPhone('2');
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.outcome).toBe('already-configured');
  });

  it('returns to idle when the student dismisses the system dialog', async () => {
    // RESULT_CANCELED revokes nothing, so the honest state is "not done yet" —
    // an error banner here would scold someone for changing their mind.
    await onPhone('(none)', 0);
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.outcome).toBe('cancelled');
    expect(result.current.error).toBeNull();
  });

  it('surfaces a genuine add failure as an error', async () => {
    await onPhone('1');
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.outcome).toBe('failed');
  });

  it('configures natively on iOS too, reading the outcome the Swift plugin resolved', async () => {
    const { putTransfer } = await import('../../../api/eduroamTransfer');
    const native = await import('../../../mobile/eduroamNative');
    vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(true);
    vi.mocked(native.nativeEduroamDeps.configure).mockResolvedValue({ outcome: 'saved' });
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.outcome).toBe('saved');
    expect(result.current.qrDataUrl).toBeNull();
    expect(putTransfer).not.toHaveBeenCalled();
  });

  it('keeps the QR transfer for Android chosen in a desktop browser', async () => {
    const { putTransfer } = await import('../../../api/eduroamTransfer');
    // Stated rather than inherited: clearAllMocks resets calls, not
    // implementations, so a preceding onPhone() would otherwise leak in here.
    const native = await import('../../../mobile/eduroamNative');
    vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(false);
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(putTransfer).toHaveBeenCalled();
    expect(result.current.qrDataUrl).toBe('data:image/png;base64,zz');
    expect(result.current.outcome).toBeNull();
  });
});
