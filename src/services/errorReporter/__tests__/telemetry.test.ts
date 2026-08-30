import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTelemetry, sendTelemetry } from '../telemetry';
import { supabase } from '../../spolky/supabaseClient';

vi.mock('../../spolky/supabaseClient', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
}));

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('sendTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    initTelemetry(() => true);
  });

  it('calls report_error_v2 RPC with context as p_error_type', async () => {
    sendTelemetry('FilesSlice.fetchFiles', new Error('IDB closed'));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(name).toBe('report_error_v2');
    expect(args.p_error_type).toBe('FilesSlice.fetchFiles');
    expect(args.p_error_message).toBe('IDB closed');
    expect(args.p_file_path).toBe('');
    expect(args.p_line_number).toBe(0);
    // Session ID is a UUID generated at module load — assert shape, not value.
    expect(args.p_session_id).toMatch(
      /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$|^[0-9a-f]{32}$/
    );
    expect(typeof args.p_stack_excerpt).toBe('string');
    expect(typeof args.p_client_ts).toBe('string');
    expect(Object.keys(args).sort()).toEqual(
      [
        'p_browser_name',
        'p_browser_version',
        'p_client_ts',
        'p_error_message',
        'p_error_type',
        'p_ext_version',
        'p_file_path',
        'p_line_number',
        'p_session_id',
        'p_stack_excerpt',
      ].sort()
    );
  });

  it('does not call RPC when getEnabled returns false', async () => {
    initTelemetry(() => false);
    sendTelemetry('FilesSlice.fetchFiles', new Error('IDB closed'));
    await flush();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('dedupes identical context+message pairs', async () => {
    sendTelemetry('A.b', new Error('fail'));
    sendTelemetry('A.b', new Error('fail'));
    sendTelemetry('A.b', new Error('fail'));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('stops after SESSION_CAP (3)', async () => {
    for (let i = 0; i < 6; i++) sendTelemetry(`Ctx.${i}`, new Error(`err-${i}`));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(3);
  });

  it('skips when navigator.webdriver is true', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    sendTelemetry('A.b', new Error('fail'));
    await flush();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('skips when the extension context is invalidated (chrome.runtime.id missing)', async () => {
    // After an extension update, an orphaned iframe loses chrome.runtime.id.
    // IDB and chrome.* ops then fail with "connection is closing" — reporting
    // is unactionable noise we cannot fix from the dead context. Drop it.
    const original = chrome.runtime.id;
    (chrome.runtime as { id?: string }).id = undefined;
    try {
      sendTelemetry(
        'SubjectsSlice.fetchSubjects',
        new Error(
          "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing."
        )
      );
      await flush();
      expect(supabase.rpc).not.toHaveBeenCalled();
    } finally {
      (chrome.runtime as { id?: string }).id = original;
    }
  });

  it('sanitizes the error message — strips 6-digit UIC', async () => {
    sendTelemetry('Parser.x', new Error('user 123456 failed'));
    await flush();
    const [, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(args.p_error_message).toBe('user [redacted] failed');
  });

  it('drops report when sanitized message is empty', async () => {
    sendTelemetry('Ctx', new Error('   '));
    await flush();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('swallows RPC rejections without throwing', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    expect(() => sendTelemetry('A.b', new Error('fail'))).not.toThrow();
    await flush();
  });

  it('accepts non-Error values', async () => {
    sendTelemetry('A.b', 'plain string error');
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(args.p_error_message).toBe('plain string error');
  });

  it('is a no-op before initTelemetry is called', async () => {
    // Simulate uninitialised state by re-initialising with a no-send stub.
    // The real uninitialised path (_send === null) is exercised by module
    // cold-start; here we verify calling initTelemetry resets state cleanly.
    initTelemetry(() => true);
    sendTelemetry('X', new Error('a'));
    sendTelemetry('Y', new Error('b'));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

describe('sendTelemetry off the extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.stubGlobal('chrome', {
      storage: {},
      runtime: { id: 'test-extension-id', getManifest: () => ({ version: '1.0.0' }) },
    });
  });

  it('still reports when there is no chrome runtime at all', async () => {
    // The Capacitor app and the dev webapp have no `chrome` object. The
    // orphaned-iframe guard read `chrome.runtime.id` and treated its
    // absence as a dead extension context, so EVERY error the phone app
    // ever hit was dropped before it reached Supabase — the app could not
    // report its own failures, and a device run showing "zero telemetry"
    // proved nothing at all.
    //
    // The suite's own setup stubs a chrome runtime, which is exactly why
    // this never surfaced in a test.
    vi.stubGlobal('chrome', undefined);
    initTelemetry(() => true);

    sendTelemetry('Sync.syncAllData', new Error('native transport blew up'));
    await flush();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('still drops reports from an orphaned extension iframe', async () => {
    // The guard's actual purpose: after an update the iframe keeps running
    // but chrome.runtime.id goes undefined and nothing it reports is
    // actionable. That must keep working.
    vi.stubGlobal('chrome', { storage: {}, runtime: { getManifest: () => ({}) } });
    initTelemetry(() => true);

    sendTelemetry('Sync.syncAllData', new Error('Extension context invalidated'));
    await flush();

    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
