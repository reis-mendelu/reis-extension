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
};

/**
 * Taken once when a tool call starts: how many times clear() had run, and the
 * persistence token (a forget() since cancels the call's saves). A call that
 * began before a forget keeps and saves nothing, wherever it is by then.
 */
export type Ticket = { epoch: number; token: unknown };
