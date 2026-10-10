// Spawns the built reIS for Claude bundle and speaks MCP over stdio:
// initialize, then tools/list. With --live it also calls mendelu_exams against
// real IS, using MENDELU_USER/MENDELU_PASS from the environment (never printed).
import { spawn } from 'node:child_process';

const live = process.argv.includes('--live');
const child = spawn(process.execPath, ['dist-mcp/server/index.mjs'], {
  env: {
    ...process.env,
    MENDELU_USER: process.env.MENDELU_USER ?? 'smoke',
    MENDELU_PASS: process.env.MENDELU_PASS ?? 'smoke',
  },
  stdio: ['pipe', 'pipe', 'inherit'],
});
child.on('exit', (code) => {
  if (code) {
    console.error(`smoke: server exited with ${code}`);
    process.exit(1);
  }
});

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

const timer = setTimeout(() => {
  console.error('smoke: timed out');
  process.exit(1);
}, 90000);

await call('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0' },
});
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const tools = (await call('tools/list', {})).result.tools.map((t) => t.name).sort();
console.log('tools:', tools.length, tools.join(', '));
let failed = tools.length !== 10;

for (const name of live ? process.argv.slice(3).concat(['mendelu_exams']) : []) {
  const r = await call('tools/call', { name, arguments: {} });
  const text = r.result.content[0].text;
  const summary = r.result.isError
    ? `ERROR ${text}`
    : `${text.length} chars, structuredContent=${'structuredContent' in r.result}`;
  console.log(`${name}: ${summary}`);
  if (r.result.isError) failed = true;
}

clearTimeout(timer);
child.removeAllListeners('exit');
child.kill();
process.exit(failed ? 1 : 0);
