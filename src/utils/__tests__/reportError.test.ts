import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { logError, setDemoErrorHandler } from '../reportError';
import { handleDemoError } from '../../mobile/demoToast';
import { DemoModeError } from '../../errors/demoMode';

vi.mock('sonner', () => ({ toast: vi.fn() }));
// demoToast reads the language from the store-free i18n module; 'cz' is its
// default, which is what keeps the exact-copy assertion below meaningful.

describe('logError', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // What the Capacitor bootstrap does. reportError does NOT import demoToast
    // itself — that static edge dragged sonner into the content script, where
    // its import-time stylesheet injection threw at document_start and stopped
    // the extension injecting at all.
    setDemoErrorHandler(handleDemoError);
  });

  afterEach(() => {
    setDemoErrorHandler(null);
    consoleError.mockRestore();
  });

  // The whole point of wiring handleDemoError into this single funnel: every
  // guarded path (fetchWithAuth, fetchAuthedBytes, loadStoredToken) already
  // catches into logError, so this is the one place a blocked demo tap can be
  // turned into "this is only a demo" instead of a logged fault.
  it('shows the demo toast and logs nothing for a DemoModeError', () => {
    logError('Api.fetchWithAuth', new DemoModeError());

    // The stable id is load-bearing, not incidental: two DemoModeErrors at boot
    // stacked two identical toasts on the deployed preview until it was added.
    expect(toast).toHaveBeenCalledWith('Toto je jen ukázka.', { id: 'demo-mode-notice' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  // The extension registers no handler, and the extension itself never enters
  // demo mode, so a DemoModeError cannot arise there — but logError must not
  // depend on a handler existing. Capacitor and the deployed web preview both
  // register one; see capacitor/main.capacitor.tsx and dev/earlyDemoMode.ts.
  it('falls through to the console when no demo handler is registered', () => {
    setDemoErrorHandler(null);

    expect(() => logError('Api.fetchWithAuth', new DemoModeError())).not.toThrow();
    expect(toast).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('logs an ordinary error locally', () => {
    logError('Api.fetchWithAuth', new Error('boom'));

    expect(toast).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[reIS:error] Api.fetchWithAuth: boom',
      expect.objectContaining({ context: 'Api.fetchWithAuth', msg: 'boom' })
    );
  });

  // The goal this file guards: nothing about a failure leaves the device.
  // `logError` is called from ~195 sites, so if transmission ever comes back it
  // will almost certainly come back here.
  it('makes no network call of any kind', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));

    logError('Api.fetchWithAuth', new Error('boom'));

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
