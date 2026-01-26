export interface PendingRequest<T = any> { resolve: (val: T) => void; reject: (err: Error) => void; timeout: any; }
export const pendingFetches = new Map<string, PendingRequest<string>>();
export const pendingActions = new Map<string, PendingRequest<any>>();
export const REQUEST_TIMEOUT = 30000;
