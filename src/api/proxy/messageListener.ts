import { pendingFetches, pendingActions } from './pendingRequests';

let initialized = false;
export function initProxyListener() {
    if (initialized) return; initialized = true;
    window.addEventListener('message', (e) => {
        if (e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
        const { type, id, success, data, error } = e.data;
        const handle = (map: Map<string, any>) => {
            const p = map.get(id);
            if (p) { clearTimeout(p.timeout); map.delete(id); if (success) p.resolve(data); else p.reject(new Error(error || 'Failed')); }
        };
        if (type === 'REIS_FETCH_RESULT') handle(pendingFetches);
        else if (type === 'REIS_ACTION_RESULT') handle(pendingActions);
    });
}
