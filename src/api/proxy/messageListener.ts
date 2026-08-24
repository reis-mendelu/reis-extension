import { pendingFetches, pendingActions } from './pendingRequests';
import { isTrustedProxyOrigin } from './trustedOrigin';
import { getPlatform } from '../../platform';
import { DemoModeError } from '../../errors/demoMode';

let initialized = false;
interface ProxyRequest {
  timeout: ReturnType<typeof setTimeout>;
  resolve: (data: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  reject: (err: Error) => void;
}

export function initProxyListener() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('message', (e: MessageEvent) => {
    // Capacitor replies arrive from the app's own origin, not from IS —
    // see trustedOrigin. The e.source check below is unchanged.
    if (!isTrustedProxyOrigin(e.origin, getPlatform().kind, window.location.origin)) return;
    if (e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    const { type, id, success, data, error, demoMode } = e.data;
    const handle = (map: Map<string, ProxyRequest>) => {
      const p = map.get(id);
      if (p) {
        clearTimeout(p.timeout);
        map.delete(id);
        if (success) p.resolve(data);
        // `demoMode` reconstructs the real error type: `error` is only
        // `String(e)` by this point (see actionHandler's catch), so a
        // DemoModeError would otherwise arrive here indistinguishable from any
        // other failure and never reach logError's demo-toast branch.
        else p.reject(demoMode ? new DemoModeError() : new Error(error || 'Failed'));
      }
    };
    if (type === 'REIS_FETCH_RESULT') handle(pendingFetches);
    else if (type === 'REIS_ACTION_RESULT') handle(pendingActions);
    else if (type === 'REIS_POPUP_STATE') {
      window.dispatchEvent(new CustomEvent('reis:popup-state', { detail: { open: e.data.open } }));
    }
  });
}
