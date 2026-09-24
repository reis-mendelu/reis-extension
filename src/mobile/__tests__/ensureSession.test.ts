import { describe, it, expect, vi } from 'vitest';
import {
  ensureSession,
  LoginCancelledError,
  LoginUnreachableError,
  type SessionDeps,
} from '../ensureSession';

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAA%2FBBBBBBBBBBBBBBBBBBB';

function deps(over: Partial<SessionDeps> = {}): SessionDeps {
  const remove = vi.fn(async () => {});
  return {
    getStored: vi.fn(async () => undefined),
    save: vi.fn(async () => {}),
    openLogin: vi.fn(async () => {}),
    onPageLoaded: vi.fn(async () => ({ remove })),
    readCookies: vi.fn(async () => ({ UISAuth: TOKEN })),
    closeWebView: vi.fn(async () => {}),
    ...over,
  };
}

describe('ensureSession', () => {
  it('returns the stored token without opening a login WebView', async () => {
    const d = deps({ getStored: vi.fn(async () => TOKEN) });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.openLogin).not.toHaveBeenCalled();
  });

  it('ignores a stored value too short to be a token and logs in instead', async () => {
    let fire: () => void = () => {};
    const d = deps({
      getStored: vi.fn(async () => 'abc'),
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.openLogin).toHaveBeenCalled();
  });

  it('saves and closes once a page load yields a plausible cookie', async () => {
    let fire: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.save).toHaveBeenCalledWith(TOKEN);
    expect(d.closeWebView).toHaveBeenCalled();
  });

  it('does NOT close while the student is still on the login page', async () => {
    // The pre-login page loads too. Closing on the first load event would kill
    // the WebView before the student can type anything.
    let fire: () => void = () => {};
    let calls = 0;
    const d = deps({
      readCookies: vi.fn(async (): Promise<Record<string, string>> =>
        ++calls >= 3 ? { UISAuth: TOKEN } : {}
      ),
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
        fire();
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.closeWebView).toHaveBeenCalledTimes(1);
    expect(d.save).toHaveBeenCalledTimes(1);
  });

  it('REJECTS when the student dismisses the login WebView', async () => {
    // Without this the promise never settles, and boot() awaits it before
    // hiding the splash — so a student who backs out sits on a splash screen
    // forever, with no error and no way to retry.
    let dismiss: () => void = () => {};
    const d = deps({
      readCookies: vi.fn(async () => ({})),
      onDismissed: vi.fn(async (cb: () => void) => {
        dismiss = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        dismiss();
      }),
    });
    await expect(ensureSession(d)).rejects.toThrow(/cancel|dismiss/i);
  });

  it('ignores a dismissal that arrives after a successful login', async () => {
    // The WebView close WE trigger also fires the dismissal event.
    let fire: () => void = () => {};
    let dismiss: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      onDismissed: vi.fn(async (cb: () => void) => {
        dismiss = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    const result = ensureSession(d);
    await Promise.resolve();
    dismiss();
    await expect(result).resolves.toBe(TOKEN);
  });

  it('still works when the host provides no dismissal signal', async () => {
    // onDismissed is optional; the extension-shaped deps do not have one.
    let fire: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
  });

  it('removes the dismissal listener too, so a later close is not heard', async () => {
    const removeDismiss = vi.fn(async () => {});
    let fire: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      onDismissed: vi.fn(async () => ({ remove: removeDismiss })),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await ensureSession(d);
    expect(removeDismiss).toHaveBeenCalled();
  });

  it('removes the page-load listener so a second login does not double-fire', async () => {
    const remove = vi.fn(async () => {});
    let fire: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await ensureSession(d);
    expect(remove).toHaveBeenCalled();
  });

  it('rejects with LoginCancelledError when the student backs out', async () => {
    let dismiss: () => void = () => {};
    const d = deps({
      readCookies: vi.fn(async () => ({})),
      onDismissed: vi.fn(async (cb: () => void) => {
        dismiss = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        dismiss();
      }),
    });
    await expect(ensureSession(d)).rejects.toBeInstanceOf(LoginCancelledError);
  });
});

describe('ensureSession when the login page never loads', () => {
  // The stall, not the error. A connection that is accepted and then answers
  // nothing — a captive portal holding 443, an IPv6 blackhole, a home router
  // dropping oversized packets — fires neither `onPageFinished` nor
  // `onReceivedError` in the Android WebView for minutes.
  //
  // `openWebView` is called with `isPresentAfterPageLoad: true`, and the
  // plugin shows its dialog from exactly one place: `onPageFinished`
  // (WebViewDialog.java:6370-6377; the other show() sites are gated on
  // `!isPresentAfterPageLoad` or driven from JS inside the loaded page). So
  // during a stall there is nothing on screen to look at and nothing to
  // dismiss — no `closeEvent` can arrive, because the student cannot back out
  // of a dialog that was never presented.
  //
  // That left `ensureSession` with no way to settle at all, and `boot()`
  // awaits it before `SplashScreen.hide()` under `launchAutoHide: false`:
  // splash forever, no login WebView, no error. Exactly the two symptoms
  // reported, from one cause.
  it('REJECTS instead of hanging when no page load and no dismissal ever arrive', async () => {
    vi.useFakeTimers();
    try {
      const d = deps({
        // Faithful to the stall, and the detail that makes this test worth
        // anything: `openLogin` is `await InAppBrowser.openWebView(...)`, and
        // under `isPresentAfterPageLoad` that PluginCall resolves only in
        // `onPageFinished` and rejects only in `onReceivedError`. Neither
        // fires, so THE OPEN CALL ITSELF never settles either. A deadline
        // armed after `await deps.openLogin()` would therefore never be armed
        // at all in production — while a mock that resolved here would let
        // that no-op pass. It must be armed before, or alongside.
        openLogin: vi.fn(() => new Promise<void>(() => {})),
        onDismissed: vi.fn(async () => ({ remove: vi.fn(async () => {}) })),
        firstLoadTimeoutMs: 30_000,
      });

      const result = ensureSession(d);
      const settled = vi.fn();
      void result.then(settled, settled);

      await vi.advanceTimersByTimeAsync(29_000);
      expect(settled).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      await expect(result).rejects.toBeInstanceOf(LoginUnreachableError);
      // Best-effort teardown: the dialog is hidden but alive, and leaving it
      // behind would have the next login open a second one over it.
      expect(d.closeWebView).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('REJECTS a stall even on a host whose open call resolves promptly', async () => {
    // The other shape of the same failure: a host that reports "presented"
    // straight away (no `isPresentAfterPageLoad`) and then never loads.
    vi.useFakeTimers();
    try {
      const d = deps({
        openLogin: vi.fn(async () => {}),
        onDismissed: vi.fn(async () => ({ remove: vi.fn(async () => {}) })),
        firstLoadTimeoutMs: 30_000,
      });
      // Assertion attached BEFORE the clock moves: the rejection lands inside
      // advanceTimersByTimeAsync, and a handler added afterwards makes it an
      // unhandled rejection first, which vitest fails the run on.
      const assertion = expect(ensureSession(d)).rejects.toBeInstanceOf(LoginUnreachableError);
      await vi.advanceTimersByTimeAsync(31_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not time out a student who is slowly typing their password', async () => {
    // The deadline is on the FIRST page load, not on the whole login. Once
    // that arrives the WebView is on screen (same `onPageFinished` that shows
    // it emits the event), and the student may take as long as they like.
    vi.useFakeTimers();
    try {
      let fire: () => void = () => {};
      let calls = 0;
      const d = deps({
        readCookies: vi.fn(async (): Promise<Record<string, string>> =>
          ++calls >= 2 ? { UISAuth: TOKEN } : {}
        ),
        onPageLoaded: vi.fn(async (cb: () => void) => {
          fire = cb;
          return { remove: vi.fn(async () => {}) };
        }),
        openLogin: vi.fn(async () => {
          fire();
        }),
        firstLoadTimeoutMs: 30_000,
      });

      const result = ensureSession(d);
      await vi.advanceTimersByTimeAsync(120_000);
      fire();
      await vi.advanceTimersByTimeAsync(0);
      await expect(result).resolves.toBe(TOKEN);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the deadline once login succeeds, leaving no pending timer', async () => {
    vi.useFakeTimers();
    try {
      let fire: () => void = () => {};
      const d = deps({
        onPageLoaded: vi.fn(async (cb: () => void) => {
          fire = cb;
          return { remove: vi.fn(async () => {}) };
        }),
        openLogin: vi.fn(async () => {
          fire();
        }),
        firstLoadTimeoutMs: 30_000,
      });
      await expect(ensureSession(d)).resolves.toBe(TOKEN);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
