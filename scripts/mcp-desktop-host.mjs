// Runs a built MCP server the way Claude Desktop runs it: through Desktop's own
// "MCP Node Host" (nodeHost.js inside Claude.app), in an environment that looks
// like an Electron utility process. Plain `node` hides failures that only
// happen there: on 2026-10-10 pdfjs saw process.type === 'utility', decided it
// was not in Node, and threw "DOMMatrix is not defined" at import, which the
// extension log showed only as a closed transport.
//
//   node scripts/mcp-desktop-host.mjs <server entry>   speaks MCP on stdio
//
// The host code is read from the installed Claude.app at run time (it is
// Anthropic's, so it is never copied into this repo). macOS only.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MessageChannel } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import { Socket } from 'node:net';

const ASAR = '/Applications/Claude.app/Contents/Resources/app.asar';
const HOST_PATH = '.vite/build/mcp-runtime/nodeHost.js';

const entry = process.argv[2];
if (!entry) {
  process.stderr.write('usage: node scripts/mcp-desktop-host.mjs <server entry>\n');
  process.exit(2);
}
if (!existsSync(ASAR)) {
  process.stderr.write(
    `desktop-host: ${ASAR} not found; install Claude Desktop to use this check\n`
  );
  process.exit(2);
}

// Extract nodeHost.js once per Claude.app build (keyed by the asar's mtime).
const cacheDir = join(tmpdir(), `reis-claude-nodehost-${statSync(ASAR).mtimeMs}`);
const hostFile = join(cacheDir, 'nodeHost.js');
if (!existsSync(hostFile)) {
  mkdirSync(cacheDir, { recursive: true });
  execFileSync('npx', ['-y', '@electron/asar@3.2.17', 'extract-file', ASAR, HOST_PATH], {
    cwd: cacheDir,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
if (!readFileSync(hostFile, 'utf8').includes('import-failed')) {
  process.stderr.write('desktop-host: nodeHost.js changed shape; update this harness\n');
  process.exit(2);
}

// What an Electron utility process looks like to the code it loads.
Object.defineProperty(process, 'type', { value: 'utility', configurable: true });
Object.defineProperty(process.versions, 'electron', { value: '38.0.0', enumerable: true });

// process.parentPort, as Electron gives it: one 'init' message carrying the
// MessagePort that the host then uses for stdin, stdout and stderr.
const { port1: ours, port2: hosts } = new MessageChannel();
const parentPort = new EventEmitter();
process.parentPort = parentPort;

const realStdout = process.stdout.write.bind(process.stdout);
const realStderr = process.stderr.write.bind(process.stderr);
ours.on('message', (msg) => {
  lastHostActivity = Date.now();
  // stderr is not relayed: the host already writes it to the real stderr.
  if (msg?.type === 'stdout') realStdout(msg.content);
  else if (msg?.type === 'fatal-error')
    realStderr(`[desktop-host] fatal ${msg.kind}: ${msg.message}\n`);
});

// Input arrives on fd 3, not stdin: the host rewires process.stdin's own
// methods onto its internal Readable, and in Desktop stdin carries nothing;
// every line comes over the port. So we read fd 3 and post each line, exactly
// as Desktop does. (scripts/mcp-smoke.mjs opens fd 3 for this.)
const input = new Socket({ fd: 3, readable: true, writable: false });
input.setEncoding('utf8');
let pending = '';
input.on('data', (chunk) => {
  pending += chunk;
  let i;
  while ((i = pending.indexOf('\n')) >= 0) {
    const line = pending.slice(0, i);
    pending = pending.slice(i + 1);
    // Electron's MessagePortMain delivers { data }; Node's port delivers the
    // value itself, so wrap it the way the host expects to unwrap it.
    if (line.trim()) ours.postMessage({ data: { type: 'stdin', data: line } });
  }
});
// When input closes, send any last unterminated line, then exit once the host
// has been quiet for a moment, so replies to piped requests are not cut off.
let lastHostActivity = Date.now();
input.on('end', () => {
  if (pending.trim()) ours.postMessage({ data: { type: 'stdin', data: pending } });
  pending = '';
  const QUIET_MS = 2000;
  const check = setInterval(() => {
    if (Date.now() - lastHostActivity >= QUIET_MS) {
      clearInterval(check);
      process.exit(0);
    }
  }, 200);
});

process.argv = [process.argv[0], hostFile, resolve(entry)];
createRequire(import.meta.url)(hostFile);
parentPort.emit('message', { data: { type: 'init' }, ports: [hosts] });
