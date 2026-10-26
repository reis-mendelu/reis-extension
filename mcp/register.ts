import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS, type ToolCtx } from './tools';
import { toResult, toError } from './format';

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

/** No tool declares an outputSchema: see format.ts. */
export function registerTools(server: McpServer, ctx: ToolCtx): void {
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
        try {
          return toResult(
            await t.run(args, ctx),
            args.response_format === 'json' ? 'json' : 'markdown'
          );
        } catch (e) {
          return toError(t.name, e);
        }
      }
    );
  }
}
