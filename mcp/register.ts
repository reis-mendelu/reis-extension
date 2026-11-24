import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS, type ToolCtx } from './tools';
import { toolResult, toError } from './format';
import { createToolCache, type ToolCache } from './cache';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
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
function withNotice<R extends { content: object[] }>(r: R, ctx: ToolCtx): R {
  const notice = ctx.updateNotice?.();
  return notice
    ? ({ ...r, content: [...r.content, { type: 'text' as const, text: notice }] } as R)
    : r;
}

/** No tool declares an outputSchema: see format.ts. */
export function registerTools(server: McpServer, ctx: ToolCtx): void {
  // One memory per server process: it lives as long as the session does.
  const cache = createToolCache();
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: { ...t.input, response_format: responseFormat },
        annotations: READ_ONLY,
      },
      async (args: Record<string, unknown>) => withNotice(await runTool(t, args, ctx, cache), ctx)
    );
  }
}
