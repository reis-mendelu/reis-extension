import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS, type ToolCtx } from './tools';
import { toolResult, toError } from './format';
import { createToolCache, type ToolCache } from './cache';
import type { Ticket } from './cacheTypes';
import { createMapPersist } from './storeMap';
import { OVERVIEW_TOOL, runOverview } from './overviewTool';
import { registerStoreTools } from './registerStore';
import { registerBuild } from './buildTool';
import { registerRefresh } from './refreshTool';
import { OVERVIEW, READ_ONLY, responseFormat, withNotice } from './registerKit';
// Aliased to ./documentHandover in the plugin build, like the import in files.ts.
import { EXTRACTS_TEXT } from './documentText';
import type { Store } from './store';
import { withLocalPaths } from './subjectFilesPaths';

async function runTool(
  t: (typeof TOOLS)[number],
  args: Record<string, unknown>,
  ctx: ToolCtx,
  cache: ToolCache,
  ticket: Ticket,
  store?: Store
) {
  // Before the tool runs: fetchers catch a failed request and say "try
  // again", which would hide that the login is missing.
  if (ctx.unavailable) return toError(t.name, new Error(ctx.unavailable));
  const format = args.response_format === 'json' ? 'json' : 'markdown';
  try {
    const value = await cache.run(t.name, args, () => t.run(args, ctx), ticket);
    // The saved originals' paths, on this answer only (the cache keeps the plain listing).
    return toolResult(
      store && t.name === 'mendelu_subject_files'
        ? await withLocalPaths(store, value, format)
        : value,
      format
    );
  } catch (e) {
    return toError(t.name, e);
  }
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
              run: (tool, a, fn) => cache.run(tool, a, fn, ticket, { fresh: true }),
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
  if (store && map) {
    registerBuild(server, ctx, store, cache, map.saveText, EXTRACTS_TEXT);
    registerRefresh(server, ctx, store, cache, map, EXTRACTS_TEXT);
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
        const result = await runTool(t, args, toolCtx, cache, ticket, store);
        await map?.settled();
        return withNotice(result, ctx, store);
      }
    );
  }
  if (store)
    registerStoreTools(server, ctx, store, {
      clear: () => {
        cache.clear();
        map?.reset();
      },
    });
}
