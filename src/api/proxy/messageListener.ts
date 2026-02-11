import { pendingFetches, pendingActions } from './pendingRequests';

let initialized = false;
interface ProxyRequest {
    timeout: ReturnType<typeof setTimeout>;
    resolve: (data: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    reject: (err: Error) => void;
}

export function initProxyListener() {
    if (initialized) return; initialized = true;
    window.addEventListener('message', (e: MessageEvent) => {
        if (e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
        const { type, id, success, data, error } = e.data;
        const handle = (map: Map<string, ProxyRequest>) => {
            const p = map.get(id);
            if (p) { clearTimeout(p.timeout); map.delete(id); if (success) p.resolve(data); else p.reject(new Error(error || 'Failed')); }
        };
        if (type === 'REIS_FETCH_RESULT') handle(pendingFetches);
        else if (type === 'REIS_ACTION_RESULT') handle(pendingActions);
    });
}
