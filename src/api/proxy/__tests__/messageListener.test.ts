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

/**
 * The iframe-side half of the trust boundary, and the twin of the checks in
 * injector/messageHandler.ts. This listener resolves PENDING PROMISES from an
 * incoming message — so an attacker who can post to this window can hand the app
 * fabricated IS data as the answer to a request the app itself made, and the
 * whole UI will render it as genuine.
 *
 * Both guards were previously deletable with the entire 2,517-test suite green:
 * trustedOrigin.ts measured 100% with dedicated tests, but nothing asserted that
 * this listener CALLS it. Coverage of a guard is not coverage of its use.
 */
describe('messageListener trust boundary', () => {
  beforeEach(() => {
    initProxyListener();
    pendingActions.clear();
  });

  /** A reply that is well-formed apart from the field under test. */
  function replyFrom(over: { origin?: string; source?: unknown }, id: string) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'REIS_ACTION_RESULT', id, success: true, data: 'ATTACKER PAYLOAD' },
        origin: over.origin ?? window.location.origin,
        source: (over.source ?? window.parent) as Window,
      })
    );
  }

  it('ignores a reply from an untrusted origin', async () => {
    let settled: unknown = 'PENDING';
    pendingActions.set('a1', {
      resolve: (v) => {
        settled = v;
      },
      reject: () => {
        settled = 'REJECTED';
      },
      timeout: setTimeout(() => {}, 0) as unknown as ReturnType<typeof setTimeout>,
    });

    replyFrom({ origin: 'https://evil.example' }, 'a1');

    expect(settled).toBe('PENDING');
    // Still pending: the request must not be consumed either, or the real reply
    // would arrive to an empty map and hang.
    expect(pendingActions.has('a1')).toBe(true);
  });

  it('ignores a reply whose source is not the parent frame', async () => {
    let settled: unknown = 'PENDING';
    pendingActions.set('a2', {
      resolve: (v) => {
        settled = v;
      },
      reject: () => {
        settled = 'REJECTED';
      },
      timeout: setTimeout(() => {}, 0) as unknown as ReturnType<typeof setTimeout>,
    });

    // Right origin, wrong window — a nested frame, or anything holding a handle
    // to this one. Origin alone is not enough.
    replyFrom({ source: { name: 'not-the-parent' } }, 'a2');

    expect(settled).toBe('PENDING');
    expect(pendingActions.has('a2')).toBe(true);
  });

  it('resolves a reply that passes both checks', async () => {
    // The positive control: without it the two assertions above would also pass
    // if the listener were simply broken.
    const p = settle('a3');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'REIS_ACTION_RESULT', id: 'a3', success: true, data: 'genuine' },
        origin: window.location.origin,
        source: window.parent,
      })
    );

    await expect(p).resolves.toBe('genuine');
  });
});
