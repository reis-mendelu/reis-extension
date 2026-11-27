// The pieces every tool registration shares: what each kind of tool declares about itself, the
// response_format input, and the extra line a result may carry (update notice, folder notice).
import { z } from 'zod';
import type { ToolCtx } from './tools';
import type { Store } from './store';

export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// It writes a record of what it reported, in reIS's own folder, and nothing in IS.
export const OVERVIEW = { ...READ_ONLY, idempotentHint: false } as const;

// Local only: it deletes reIS's own folder and touches nothing else, IS included.
export const FORGET = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Reads reIS's own folder only: it asks IS nothing, so it works with no login too.
export const SEARCH = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Reads IS only (GET listings and files), and writes reIS's own folder: not read-only on this computer.
export const BUILD = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// Like build, and not idempotent: it writes a record of what it reported, so a second call says less.
export const REFRESH = { ...BUILD, idempotentHint: false } as const;

export const responseFormat = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe('"markdown" (default) for a readable summary, "json" for the raw data.');

// Writes only the ledger's own files in reIS's folder; asks IS nothing, removes only on an explicit "remove".
export const LEDGER = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export /** One extra text item, so structuredContent and handed-over files stay as they are. */
function withNotice<R extends { content: object[] }>(r: R, ctx: ToolCtx, store?: Store): R {
  const folder = store?.notice();
  const lines = [
    ctx.updateNotice?.(),
    folder &&
      // The code only (EACCES): a message can carry a path with the account name.
      `reIS could not save to its folder this session (${/^[A-Z0-9_]+$/.test(folder.reason) ? folder.reason : 'unexpected error'}), so it is working from memory only.`,
  ].filter(Boolean);
  return lines.length
    ? ({ ...r, content: [...r.content, { type: 'text' as const, text: lines.join('\n') }] } as R)
    : r;
}
