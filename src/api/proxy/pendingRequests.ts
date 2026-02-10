export interface PendingRequest<T = unknown> { resolve: (val: T) => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout>; }
export const pendingFetches = new Map<string, PendingRequest<string>>();
export const pendingActions = new Map<string, PendingRequest<unknown>>();
export const REQUEST_TIMEOUT = 30000;
