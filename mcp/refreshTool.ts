// The tool definition and registration of mendelu_refresh (refreshRun.ts does the work), the
// call the student's scheduled digest routine makes (mcp/routine/digest-prompt.md). Like the
// overview it needs IS, the store and the tool cache.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolCtx } from './tools';
import type { Store } from './store';
import type { ToolCache } from './cache';
import type { createMapPersist } from './storeMap';
import { toolResult, toError } from './format';
import { REFRESH, responseFormat, withNotice } from './registerKit';
import { runRefresh } from './refreshRun';

export const REFRESH_TOOL = {
  name: 'mendelu_refresh',
  title: 'Refresh for the digest: what changed since the last refresh',
  description:
    'For the student\'s scheduled digest routine (daily or weekly), or when the student asks what is new since their last digest or refresh. For any other school question call mendelu_overview first. One call refreshes the cheap IS listings (subjects, course file listings, points, assignments, exams, timetable), compares them with what the LAST REFRESH saw (its own record, separate from the overview\'s), downloads the new or replaced files of subjects already known within the byte budget (never a whole library: a first refresh compares with the last mendelu_overview, or only records a baseline when there was none, and a new subject\'s files wait for mendelu_build_my_map), and returns: "changed" (each changed file with its `url`, `modified` date and what happened to its download, points rows, assignment deadlines, exam terms, new subjects, ledger entries whose source file changed), "recheck" (every ledger entry whose source file was replaced or is gone), "upcoming" (the next 14 days, soonest first, with days left and `attendance: yes` for events the student must come to) and "problems" (a subject IS did not answer for is reported, not fatal). Then read each new or replaced harmonogram, conditions or brief file with mendelu_read_file and save every date it states with mendelu_ledger. It only reads IS and writes only reIS\'s own folder: it never sends mail and never writes a calendar.',
} as const;

export function registerRefresh(
  server: McpServer,
  ctx: ToolCtx,
  store: Store,
  cache: ToolCache,
  map: ReturnType<typeof createMapPersist>,
  extractsText: boolean
): void {
  server.registerTool(
    REFRESH_TOOL.name,
    {
      title: REFRESH_TOOL.title,
      description: REFRESH_TOOL.description,
      inputSchema: { response_format: responseFormat },
      annotations: REFRESH,
    },
    async (args: Record<string, unknown>) => {
      if (ctx.unavailable)
        return withNotice(toError(REFRESH_TOOL.name, new Error(ctx.unavailable)), ctx, store);
      // One ticket for the whole run: a forget() after this moment cancels every save and stops it.
      const ticket = await cache.ticket();
      const format = args.response_format === 'json' ? 'json' : 'markdown';
      let result;
      try {
        result = toolResult(
          await runRefresh({
            store,
            ctx: { ...ctx, noteStudy: (p) => map.saveProfile(p, ticket.token) },
            run: (tool, a, fn) => cache.run(tool, a, fn, ticket, { fresh: true }),
            token: ticket.token,
            settled: map.settled,
            saveText: (url, value, stamp) => map.saveText(url, value, stamp, ticket.token),
            extractsText,
            format,
          }),
          format
        );
      } catch (e) {
        result = toError(REFRESH_TOOL.name, e);
      }
      await map.settled();
      return withNotice(result, ctx, store);
    }
  );
}
