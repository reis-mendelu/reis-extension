import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProxyListener } from '../messageListener';
import { pendingActions } from '../pendingRequests';
import { DemoModeError } from '../../../errors/demoMode';

// Capacitor is the only platform where REIS_ACTION_RESULT loops back through
// postMessage to the app's own window rather than crossing a real content
// script / iframe boundary — see isTrustedProxyOrigin and sendToIframe.
vi.mock('../../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'capacitor' })) }));

function settle(id: string) {
  return new Promise((resolve, reject) => {
    pendingActions.set(id, {
      resolve,
      reject,
      timeout: setTimeout(() => {}, 0) as unknown as ReturnType<typeof setTimeout>,
    });
  });
}

// The event is constructed rather than posted: jsdom's window.postMessage
// delivers an event whose `source` is neither `window` nor `window.parent`, so
// the listener's `e.source !== window.parent` guard would drop it. A real
// top-level browser window sets source === window === window.parent, which is
// what this reproduces.
function reply(data: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: window.location.origin, source: window.parent })
  );
}

describe('messageListener REIS_ACTION_RESULT', () => {
  beforeEach(() => {
    initProxyListener();
    pendingActions.clear();
  });

  // The reply arrives with `error` already collapsed to `String(e)` by
  // actionHandler's catch — without the `demoMode` flag reconstructing the
  // class here, a DemoModeError would be indistinguishable from any other
  // failure by the time it reaches logError.
  it('rejects with a real DemoModeError when the reply carries the demoMode flag', async () => {
    const promise = settle('req-1');

    reply({
      type: 'REIS_ACTION_RESULT',
      id: 'req-1',
      success: false,
      error: 'DemoModeError: Blocked: reIS is in demo mode',
      demoMode: true,
    });

    await expect(promise).rejects.toBeInstanceOf(DemoModeError);
  });

  it('rejects with a plain Error carrying the message when demoMode is absent', async () => {
    const promise = settle('req-2');

    reply({ type: 'REIS_ACTION_RESULT', id: 'req-2', success: false, error: 'boom' });

    await expect(promise).rejects.toThrow('boom');
    await promise.catch((e) => {
      expect(e).not.toBeInstanceOf(DemoModeError);
    });
  });
});
