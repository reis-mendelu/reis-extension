// FIRST import: installs DOM/IndexedDB globals and the delegating fetch before
// any src/api module is evaluated.
import { nativeFetch, setSessionFetch } from './globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createIsSession, noLoginFetch, NO_LOGIN_MESSAGE } from './session';
import { registerTools } from './register';
import { startUpdateCheck } from './updateCheck';
import { createStore } from './store';
// The one version: the app's. reIS for Claude ships with every app release that
// changes it (scripts/mcp-publish.mjs), and mcp-pack.mjs / mcp-plugin.mjs stamp
// the same version on the .mcpb manifest and the plugin.
import { version } from '../package.json';

const user = process.env.MENDELU_USER?.trim();
const pass = process.env.MENDELU_PASS;
const sessionFetch =
  user && pass ? createIsSession({ user, pass }, nativeFetch).fetch : noLoginFetch;
// stderr only: stdout is the MCP protocol stream.
if (sessionFetch === noLoginFetch) process.stderr.write(`reIS for Claude: ${NO_LOGIN_MESSAGE}\n`);
setSessionFetch(sessionFetch);

// The map on disk: one folder per laptop, shared by every host (store.ts). Nothing
// is created until something is saved; a folder that cannot be written means
// memory only, never a failed start. It never holds the password or the cookie.
const store = createStore();
void store.rebuild(); // the index is only a cache of the files: repair it, in the background

const server = new McpServer({ name: 'reis-mendelu', version });
registerTools(
  server,
  {
    fetch: sessionFetch,
    // nativeFetch: the GitHub check must never go through the IS session.
    updateNotice: startUpdateCheck(version, nativeFetch),
    ...(sessionFetch === noLoginFetch ? { unavailable: NO_LOGIN_MESSAGE } : {}),
  },
  store
);
// No top-level await, so the entry also loads through require(). Claude
// Desktop's own host uses import() (nodeHost.js); its real constraint is the
// utility-process environment, handled in globals.ts.
server.connect(new StdioServerTransport()).catch((e: unknown) => {
  process.stderr.write(
    `reIS for Claude: could not start (${e instanceof Error ? e.message : String(e)}).\n`
  );
  process.exit(1);
});
