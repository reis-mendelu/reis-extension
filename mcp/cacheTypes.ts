// The two shapes the tool cache and the store layer (storeMap.ts) agree on.

/**
 * The second tier (storeMap.ts). `load` runs on a memory miss, before IS is
 * asked, and returns an answer the disk can vouch for or undefined; `stamp` is
 * the listing date known now (a file read only; undefined before any listing).
 * `save` gets what IS answered. Neither may throw into a tool.
 */
export type Persist = {
  /** Taken when a request starts, handed back to save(): a forget() in between cancels the save. */
  begin(): Promise<unknown>;
  load(tool: string, args: Record<string, unknown>, stamp: string | undefined): Promise<unknown>;
  save(
    tool: string,
    args: Record<string, unknown>,
    value: unknown,
    stamp: string | undefined,
    token?: unknown
  ): Promise<unknown>;
  /**
   * Asked before a held answer is served again: false drops it (a saved file it points at was
   * evicted), and the call goes on as a miss. Absent means always valid.
   */
  stillValid?(
    tool: string,
    args: Record<string, unknown>,
    value: unknown,
    stamp: string | undefined
  ): Promise<boolean>;
};

/**
 * What `save` may resolve to: the answer later calls in this process get instead of the
 * one just saved (the plugin build: a kept file's path rather than its bytes again).
 */
export type Replacement = { replaceWith: unknown };
export const isReplacement = (v: unknown): v is Replacement =>
  !!v && typeof v === 'object' && 'replaceWith' in v && !!(v as Replacement).replaceWith;

/**
 * Taken once when a tool call starts: how many times clear() had run, and the
 * persistence token (a forget() since cancels the call's saves). A call that
 * began before a forget keeps and saves nothing, wherever it is by then.
 */
export type Ticket = { epoch: number; token: unknown };

/** The folder's forget token inside a persist token (storeMap.ts begin(): `{ gen, at }`). */
export const genOf = (token: unknown) =>
  token && typeof token === 'object' && 'gen' in token ? (token as { gen: unknown }).gen : token;
