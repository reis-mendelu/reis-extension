export interface PendingRequest<T = unknown> {
  resolve: (val: T) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}
export interface PendingFetch extends PendingRequest<string> {
  /** A REIS_FETCH_PROGRESS tick for this request. Re-arms `timeout`. */
  onProgress: (tick: { loaded: number; total: number | null }) => void;
}
export const pendingFetches = new Map<string, PendingFetch>();
export const pendingActions = new Map<string, PendingRequest<unknown>>();
/**
 * How long a request may go without an answer. For a 'file' fetch it is the
 * gap between progress ticks, not the whole download: a 40 MB PDF on slow
 * wifi takes longer than this and is not stuck.
 */
export const REQUEST_TIMEOUT = 30000;
