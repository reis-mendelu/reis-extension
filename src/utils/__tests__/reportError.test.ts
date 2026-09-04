import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { logError, setDemoErrorHandler } from '../reportError';
import { handleDemoError } from '../../mobile/demoToast';
import { DemoModeError } from '../../errors/demoMode';
import { sendTelemetry } from '../../services/errorReporter/telemetry';

vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('../../services/errorReporter/telemetry', () => ({ sendTelemetry: vi.fn() }));
// demoToast reads the language from the store-free i18n module; 'cz' is its
// default, which is what keeps the exact-copy assertion below meaningful.

describe('logError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // What the Capacitor bootstrap does. reportError does NOT import demoToast
    // itself — that static edge dragged sonner into the content script, where
    // its import-time stylesheet injection threw at document_start and stopped
    // the extension injecting at all.
    setDemoErrorHandler(handleDemoError);
  });

  afterEach(() => {
    setDemoErrorHandler(null);
  });

  // The whole point of wiring handleDemoError into this single funnel: every
  // guarded path (fetchWithAuth, fetchAuthedBytes, loadStoredToken) already
  // catches into logError, so this is the one place a blocked demo tap can be
  // turned into "this is only a demo" instead of a reported fault.
  it('shows the demo toast and reports nothing to telemetry for a DemoModeError', () => {
    logError('Api.fetchWithAuth', new DemoModeError());

    expect(toast).toHaveBeenCalledWith('Toto je jen ukázka.');
    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  // The extension registers no handler, and the extension itself never
  // enters demo mode, so a DemoModeError cannot arise there — but logError
  // must not depend on a handler existing (Capacitor and the deployed web
  // preview both register one; see capacitor/main.capacitor.tsx and
  // dev/earlyDemoMode.ts).
  it('falls through to telemetry when no demo handler is registered', () => {
    setDemoErrorHandler(null);
    const err = new DemoModeError();

    expect(() => logError('Api.fetchWithAuth', err)).not.toThrow();
    expect(toast).not.toHaveBeenCalled();
    expect(sendTelemetry).toHaveBeenCalledWith('Api.fetchWithAuth', err);
  });

  it('still reports normally for an ordinary error', () => {
    const err = new Error('boom');
    logError('Api.fetchWithAuth', err);

    expect(toast).not.toHaveBeenCalled();
    expect(sendTelemetry).toHaveBeenCalledWith('Api.fetchWithAuth', err);
  });
});
