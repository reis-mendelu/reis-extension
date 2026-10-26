// FIRST import: installs DOM/IndexedDB globals and the delegating fetch before
// any src/api module is evaluated.
import { nativeFetch, setSessionFetch } from './globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createIsSession } from './session';
import { registerTools } from './register';

const user = process.env.MENDELU_USER?.trim();
const pass = process.env.MENDELU_PASS;
if (!user || !pass) {
  // stderr only: stdout is the MCP protocol stream.
  process.stderr.write(
    'reIS for Claude: set your IS Mendelu username and password in the extension settings.\n'
  );
  process.exit(1);
}

const session = createIsSession({ user, pass }, nativeFetch);
setSessionFetch(session.fetch);

const server = new McpServer({ name: 'reis-mendelu', version: '0.1.3' });
registerTools(server, { fetch: session.fetch });
// No top-level await, so the entry also loads through require(). Claude
// Desktop's own host uses import() (nodeHost.js); its real constraint is the
// utility-process environment, handled in globals.ts.
server.connect(new StdioServerTransport()).catch((e: unknown) => {
  process.stderr.write(
    `reIS for Claude: could not start (${e instanceof Error ? e.message : String(e)}).\n`
  );
  process.exit(1);
});
