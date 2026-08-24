import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { logError } from '../reportError';
import { DemoModeError } from '../../errors/demoMode';
import { sendTelemetry } from '../../services/errorReporter/telemetry';

vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('../../services/errorReporter/telemetry', () => ({ sendTelemetry: vi.fn() }));
// demoToast reads the language off the real store; pinning it here keeps the
// assertion below about the exact translated copy meaningful rather than
// coupled to whatever the store's default happens to be.
vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ language: 'cz' }) },
}));

describe('logError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('still reports normally for an ordinary error', () => {
    const err = new Error('boom');
    logError('Api.fetchWithAuth', err);

    expect(toast).not.toHaveBeenCalled();
    expect(sendTelemetry).toHaveBeenCalledWith('Api.fetchWithAuth', err);
  });
});
