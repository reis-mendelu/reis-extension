import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS, type ToolCtx } from './tools';
import { toolResult, toError } from './format';
import { createToolCache, type ToolCache } from './cache';
import type { Ticket } from './cacheTypes';
import { createMapPersist } from './storeMap';
import { FORGET_TOOL, forgetEverything } from './forgetTool';
import { OVERVIEW_TOOL, runOverview } from './overviewTool';
// Aliased to ./documentHandover in the plugin build, like the import in files.ts.
import { EXTRACTS_TEXT } from './documentText';
import type { Store } from './store';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// It writes a record of what it reported, in reIS's own folder, and nothing in IS.
const OVERVIEW = { ...READ_ONLY, idempotentHint: false } as const;

// Local only: it deletes reIS's own folder and touches nothing else, IS included.
const FORGET = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const responseFormat = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe('"markdown" (default) for a readable summary, "json" for the raw data.');

async function runTool(
  t: (typeof TOOLS)[number],
  args: Record<string, unknown>,
  ctx: ToolCtx,
  cache: ToolCache,
  ticket: Ticket
) {
  // Before the tool runs: fetchers catch a failed request and say "try
  // again", which would hide that the login is missing.
  if (ctx.unavailable) return toError(t.name, new Error(ctx.unavailable));
  try {
    return toolResult(
      await cache.run(t.name, args, () => t.run(args, ctx), ticket),
      args.response_format === 'json' ? 'json' : 'markdown'
    );
  } catch (e) {
    return toError(t.name, e);
  }
}

/** One extra text item, so structuredContent and handed-over files stay as they are. */
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

/**
 * No tool declares an outputSchema: see format.ts. With a `store`, what the
 * tools read is kept on disk and a file's text survives a restart; without one
 * (tests) everything stays in this process's memory.
 */
export function registerTools(server: McpServer, ctx: ToolCtx, store?: Store): void {
  const map = store && createMapPersist(store, { extractsText: EXTRACTS_TEXT });
  // The first tier lives as long as this server process does.
  const cache = createToolCache({ persist: map?.persist });
  // First, so it heads the tool list: it is the front door (overviewTool.ts).
  if (store && map) {
    server.registerTool(
      OVERVIEW_TOOL.name,
      {
        title: OVERVIEW_TOOL.title,
        description: OVERVIEW_TOOL.description,
        inputSchema: { response_format: responseFormat },
        annotations: OVERVIEW,
      },
      async (args: Record<string, unknown>) => {
        if (ctx.unavailable) {
          return withNotice(toError(OVERVIEW_TOOL.name, new Error(ctx.unavailable)), ctx, store);
        }
        const ticket = await cache.ticket();
        const format = args.response_format === 'json' ? 'json' : 'markdown';
        let result;
        try {
          result = toolResult(
            await runOverview({
              store,
              ctx: { ...ctx, noteStudy: (p) => map.saveProfile(p, ticket.token) },
              run: (tool, a, fn) => cache.run(tool, a, fn, ticket),
              token: ticket.token,
              settled: map.settled,
              extractsText: EXTRACTS_TEXT,
              format,
            }),
            format
          );
        } catch (e) {
          result = toError(OVERVIEW_TOOL.name, e);
        }
        await map.settled();
        return withNotice(result, ctx, store);
      }
    );
  }
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: { ...t.input, response_format: responseFormat },
        annotations: READ_ONLY,
      },
      async (args: Record<string, unknown>) => {
        // One ticket per call, taken before it does anything: a forget() after this
        // moment, in this process or another, cancels what the call keeps or saves.
        const ticket = await cache.ticket();
        const toolCtx: ToolCtx = map
          ? { ...ctx, noteStudy: (p) => map.saveProfile(p, ticket.token) }
          : ctx;
        const result = await runTool(t, args, toolCtx, cache, ticket);
        await map?.settled();
        return withNotice(result, ctx, store);
      }
    );
  }
  if (!store) return;
  // Not behind the IS login check: deleting local files must work without one.
  server.registerTool(
    FORGET_TOOL.name,
    {
      title: FORGET_TOOL.title,
      description: FORGET_TOOL.description,
      inputSchema: { response_format: responseFormat },
      annotations: FORGET,
    },
    async (args: Record<string, unknown>) => {
      let result;
      try {
        result = toolResult(
          await forgetEverything(store, () => {
            cache.clear();
            map?.reset();
          }),
          args.response_format === 'json' ? 'json' : 'markdown'
        );
      } catch (e) {
        result = toError(FORGET_TOOL.name, e);
      }
      return withNotice(result, ctx, store);
    }
  );
}
