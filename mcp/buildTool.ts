// The tool definition and registration of mendelu_build_my_map (buildMap.ts does the work).
// Split from register.ts. Like the overview it needs IS, the store and the tool cache.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolCtx } from './tools';
import type { Store } from './store';
import type { ToolCache } from './cache';
import { toolResult, toError } from './format';
import { BUILD, responseFormat, withNotice } from './registerKit';
import { buildMap } from './buildMap';

export const BUILD_TOOL = {
  name: 'mendelu_build_my_map',
  title: 'Build my map: save every course file on this computer',
  description:
    "Saves the original of every file in every enrolled subject's IS folder on this computer (PDFs, slides, zips as they are, data files), plus their text where this build reads it, so later questions are answered from the saved files and Claude can open them by their path (mendelu_overview lists each saved file's `localPath`). Use it the FIRST time reIS is used on this computer, or when the student asks to build, fill or download their map or all their course files. Always call it first with dry_run true (the default): that downloads nothing and reports per subject how many files there are, of which types, and how many are already saved; IS lists no file sizes, so the total size is unknown until download. Tell the student those counts, then call it with dry_run false to download. That downloads only files not already saved for the date IS shows (running it again resumes), stops at the byte budget and says what it skipped and why, and lists files that failed. It only READS from IS (no submission, no registration, nothing changed there) and writes only reIS's own folder, which mendelu_forget_everything deletes.",
  input: {
    dry_run: z
      .boolean()
      .default(true)
      .describe(
        'true (default): count files and types per subject, download nothing. false: download.'
      ),
  },
} as const;

export function registerBuild(
  server: McpServer,
  ctx: ToolCtx,
  store: Store,
  cache: ToolCache,
  saveText: (url: string, value: unknown, stamp: string, token: unknown) => Promise<boolean>,
  extractsText: boolean
): void {
  server.registerTool(
    BUILD_TOOL.name,
    {
      title: BUILD_TOOL.title,
      description: BUILD_TOOL.description,
      inputSchema: { ...BUILD_TOOL.input, response_format: responseFormat },
      annotations: BUILD,
    },
    async (args: Record<string, unknown>) => {
      if (ctx.unavailable)
        return withNotice(toError(BUILD_TOOL.name, new Error(ctx.unavailable)), ctx, store);
      // One ticket for the whole run: a forget() after this moment cancels every save and stops it.
      const ticket = await cache.ticket();
      const token = ticket.token as { gen: string | null; at: number } | null;
      let result;
      try {
        result = toolResult(
          await buildMap({
            store,
            ctx,
            run: (tool, a, fn) => cache.run(tool, a, fn, ticket),
            token: token && typeof token === 'object' && 'gen' in token ? token : null,
            saveText: (url, value, stamp) => saveText(url, value, stamp, token),
            extractsText,
            dryRun: args.dry_run !== false,
          }),
          args.response_format === 'json' ? 'json' : 'markdown'
        );
      } catch (e) {
        result = toError(BUILD_TOOL.name, e);
      }
      return withNotice(result, ctx, store);
    }
  );
}
