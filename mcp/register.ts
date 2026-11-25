import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS, type ToolCtx } from './tools';
import { toolResult, toError } from './format';
import { createToolCache, type ToolCache } from './cache';
import { createMapPersist } from './storeMap';
import { FORGET_TOOL, forgetEverything } from './forgetTool';
import type { Store } from './store';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

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
  cache: ToolCache
) {
  // Before the tool runs: fetchers catch a failed request and say "try
  // again", which would hide that the login is missing.
  if (ctx.unavailable) return toError(t.name, new Error(ctx.unavailable));
  try {
    return toolResult(
      await cache.run(t.name, args, () => t.run(args, ctx)),
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
      `reIS could not save to its folder this session (${folder.reason}), so it is working from memory only.`,
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
  const map = store && createMapPersist(store);
  // The first tier lives as long as this server process does.
  const cache = createToolCache({ persist: map?.persist });
  const toolCtx: ToolCtx = map ? { ...ctx, noteStudy: (p) => map.saveProfile(p) } : ctx;
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
        const result = await runTool(t, args, toolCtx, cache);
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
          await forgetEverything(store, () => cache.clear()),
          args.response_format === 'json' ? 'json' : 'markdown'
        );
      } catch (e) {
        result = toError(FORGET_TOOL.name, e);
      }
      return withNotice(result, ctx, store);
    }
  );
}
