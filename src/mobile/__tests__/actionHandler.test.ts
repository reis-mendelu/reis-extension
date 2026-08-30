import { describe, it, expect, vi } from 'vitest';
import {
  runMobileAction,
  handleMobileActionMessage,
  type MobileActionDeps,
} from '../actionHandler';

function deps(over: Partial<MobileActionDeps> = {}): MobileActionDeps {
  return {
    downloadDocument: vi.fn(async () => ({ usedFallback: false })),
    refreshExams: vi.fn(async () => {}),
    syncAllData: vi.fn(async () => {}),
    ...over,
  };
}

describe('runMobileAction', () => {
  it('routes download_document to the native download with url, filename and fallback', async () => {
    const d = deps();
    await runMobileAction(
      'download_document',
      {
        url: 'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?x=1',
        filename: 'P.pdf',
        fallbackUrl: 'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?plain=1',
      },
      d
    );
    expect(d.downloadDocument).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?x=1',
      'P.pdf',
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?plain=1'
    );
  });

  it('reports usedFallback back to the caller so the UI can flag an unsealed copy', async () => {
    const d = deps({ downloadDocument: vi.fn(async () => ({ usedFallback: true })) });
    const result = await runMobileAction(
      'download_document',
      { url: 'https://is.mendelu.cz/x', filename: 'P.pdf', fallbackUrl: 'https://is.mendelu.cz/y' },
      d
    );
    expect(result).toEqual({ success: true, usedFallback: true });
  });

  it('rejects download_document with a missing url or filename before touching the network', async () => {
    const d = deps();
    await expect(runMobileAction('download_document', { filename: 'P.pdf' }, d)).rejects.toThrow(
      /url/i
    );
    await expect(
      runMobileAction('download_document', { url: 'https://is.mendelu.cz/x' }, d)
    ).rejects.toThrow(/filename/i);
    expect(d.downloadDocument).not.toHaveBeenCalled();
  });

  it('routes refresh_exams and trigger_sync to their in-process functions', async () => {
    const d = deps();
    expect(await runMobileAction('refresh_exams', {}, d)).toEqual({ success: true });
    expect(await runMobileAction('trigger_sync', {}, d)).toEqual({ success: true });
    expect(d.refreshExams).toHaveBeenCalledOnce();
    expect(d.syncAllData).toHaveBeenCalledOnce();
  });

  it.each(['open_url', 'logout', 'download_file'])(
    'rejects the unsupported action %s immediately, naming it',
    async (action) => {
      // The whole point of the default: today every one of these hangs for 30s
      // and then shows a generic error indistinguishable from a network fault.
      await expect(runMobileAction(action, {}, deps())).rejects.toThrow(
        new RegExp(`${action}.*not available`, 'i')
      );
    }
  );

  it('propagates a failure from the underlying download rather than swallowing it', async () => {
    const d = deps({
      downloadDocument: vi.fn(async () => {
        throw new Error('IS did not return a file');
      }),
    });
    await expect(
      runMobileAction('download_document', { url: 'https://is.mendelu.cz/x', filename: 'a.pdf' }, d)
    ).rejects.toThrow(/did not return a file/);
  });
});

describe('handleMobileActionMessage', () => {
  const own = {} as Window;

  function msg(over: Record<string, unknown> = {}) {
    return {
      source: own,
      data: {
        type: 'REIS_ACTION',
        id: 'req-1',
        action: 'trigger_sync',
        payload: {},
        ...((over.data as object) ?? {}),
      },
      ...over,
    } as unknown as MessageEvent;
  }

  it('replies with success and the action result', async () => {
    const reply = vi.fn();
    await handleMobileActionMessage(msg(), own, deps(), reply);
    expect(reply).toHaveBeenCalledWith({
      type: 'REIS_ACTION_RESULT',
      id: 'req-1',
      success: true,
      data: { success: true },
      error: undefined,
    });
  });

  it('replies with success:false instead of throwing into the listener', async () => {
    const reply = vi.fn();
    const d = deps({
      syncAllData: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await handleMobileActionMessage(msg(), own, d, reply);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'req-1', success: false, error: expect.stringMatching(/boom/) })
    );
  });

  it('ignores a message from a different window source', async () => {
    const reply = vi.fn();
    const d = deps();
    await handleMobileActionMessage(msg({ source: {} as Window }), own, d, reply);
    expect(d.syncAllData).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it('ignores messages that are not REIS_ACTION', async () => {
    const reply = vi.fn();
    const d = deps();
    await handleMobileActionMessage(
      msg({ data: { type: 'REIS_SYNC_UPDATE', data: {} } }),
      own,
      d,
      reply
    );
    expect(reply).not.toHaveBeenCalled();
  });

  it('still replies for an unsupported action, so the caller fails fast rather than timing out', async () => {
    const reply = vi.fn();
    await handleMobileActionMessage(
      msg({ data: { type: 'REIS_ACTION', id: 'req-9', action: 'logout', payload: {} } }),
      own,
      deps(),
      reply
    );
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'req-9',
        success: false,
        error: expect.stringMatching(/logout/),
      })
    );
  });
});
