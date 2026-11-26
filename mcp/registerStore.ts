// The tools that work on reIS's own folder and ask IS nothing, so none sits behind the IS login
// check: forget everything, search (step 4) and the ledger (step 4b). Split from register.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolCtx } from './tools';
import type { Store } from './store';
import { toolResult, toError } from './format';
import { FORGET_TOOL, forgetEverything } from './forgetTool';
import { SEARCH_TOOL, runSearch } from './searchTool';
import { LEDGER_TOOL } from './ledgerToolDef';
import { runLedger } from './ledgerTool';
import { FORGET, LEDGER, SEARCH, responseFormat, withNotice } from './registerKit';

export function registerStoreTools(
  server: McpServer,
  ctx: ToolCtx,
  store: Store,
  { clear }: { clear: () => void }
): void {
  const format = (args: Record<string, unknown>) =>
    args.response_format === 'json' ? 'json' : 'markdown';
  const answer = async (
    name: string,
    args: Record<string, unknown>,
    run: () => Promise<unknown>
  ) => {
    let result;
    try {
      result = toolResult(await run(), format(args));
    } catch (e) {
      result = toError(name, e);
    }
    return withNotice(result, ctx, store);
  };
  server.registerTool(
    FORGET_TOOL.name,
    {
      title: FORGET_TOOL.title,
      description: FORGET_TOOL.description,
      inputSchema: { response_format: responseFormat },
      annotations: FORGET,
    },
    (args: Record<string, unknown>) =>
      answer(FORGET_TOOL.name, args, () => forgetEverything(store, clear))
  );
  server.registerTool(
    SEARCH_TOOL.name,
    {
      title: SEARCH_TOOL.title,
      description: SEARCH_TOOL.description,
      inputSchema: { ...SEARCH_TOOL.input, response_format: responseFormat },
      annotations: SEARCH,
    },
    (args: Record<string, unknown>) => answer(SEARCH_TOOL.name, args, () => runSearch(store, args))
  );
  server.registerTool(
    LEDGER_TOOL.name,
    {
      title: LEDGER_TOOL.title,
      description: LEDGER_TOOL.description,
      inputSchema: { ...LEDGER_TOOL.input, response_format: responseFormat },
      annotations: LEDGER,
    },
    (args: Record<string, unknown>) => answer(LEDGER_TOOL.name, args, () => runLedger(store, args))
  );
}
