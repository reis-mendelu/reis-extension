// Spawns the built reIS for Claude bundle and speaks MCP over stdio.
//
//   node scripts/mcp-smoke.mjs                 initialize + tools/list (no IS traffic)
//   node scripts/mcp-smoke.mjs --live [tool…]  also calls mendelu_exams and the named
//                                              tools against real IS, with
//                                              MENDELU_USER/MENDELU_PASS from the
//                                              environment (never printed)
import { spawn } from 'node:child_process';

const live = process.argv.includes('--live');
const extraTools = process.argv.slice(2).filter((a) => a !== '--live');

// Live mode never logs in with placeholder credentials: that would be a failed
// login against IS. Offline mode never logs in at all, so placeholders are fine.
if (live && !(process.env.MENDELU_USER && process.env.MENDELU_PASS)) {
  console.error('smoke: --live needs MENDELU_USER and MENDELU_PASS in the environment');
  process.exit(1);
}

const child = spawn(process.execPath, ['dist-mcp/server/index.mjs'], {
  env: {
    ...process.env,
    MENDELU_USER: process.env.MENDELU_USER || 'smoke',
    MENDELU_PASS: process.env.MENDELU_PASS || 'smoke',
  },
  stdio: ['pipe', 'pipe', 'inherit'],
});

/** Every exit path goes through here, so the server never outlives the smoke. */
function finish(code, message) {
  if (message) console.error(`smoke: ${message}`);
  child.removeAllListeners('exit');
  child.kill();
  process.exit(code);
}
child.on('exit', (code) => finish(1, `server exited with ${code}`));
child.stdin.on('error', (e) => finish(1, `server stdin: ${e.message}`));
const timer = setTimeout(() => finish(1, 'timed out'), 90000);

let buf = '';
const waiters = new Map();
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    const msg = JSON.parse(line);
    waiters.get(msg.id)?.(msg);
  }
});

let id = 0;
const call = (method, params) =>
  new Promise((resolve) => {
    const n = ++id;
    waiters.set(n, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n');
  });

await call('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0' },
});
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const tools = (await call('tools/list', {})).result.tools.map((t) => t.name).sort();
console.log('tools:', tools.length, tools.join(', '));
let failed = tools.length !== 10;

for (const name of live ? [...extraTools, 'mendelu_exams'] : []) {
  const r = await call('tools/call', { name, arguments: {} });
  const text = r.result.content[0].text;
  const summary = r.result.isError
    ? `ERROR ${text}`
    : `${text.length} chars, structuredContent=${'structuredContent' in r.result}`;
  console.log(`${name}: ${summary}`);
  if (r.result.isError) failed = true;
}

clearTimeout(timer);
finish(failed ? 1 : 0);
