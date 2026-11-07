// Spawns the built reIS for Claude bundle and speaks MCP over stdio.
//
//   node scripts/mcp-smoke.mjs                 initialize + tools/list (no IS traffic)
//   node scripts/mcp-smoke.mjs --live [tool…]  also calls mendelu_exams and the named
//                                              tools against real IS, with
//                                              MENDELU_USER/MENDELU_PASS from the
//                                              environment (never printed)
//   … --desktop-host                           runs the server through Claude
//                                              Desktop's own node host (macOS,
//                                              Claude installed), where it really runs
import { spawn } from 'node:child_process';

const live = process.argv.includes('--live');
const desktopHost = process.argv.includes('--desktop-host');
const extraTools = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// Live mode never logs in with placeholder credentials: that would be a failed
// login against IS. Offline mode never logs in at all, so placeholders are fine.
if (live && !(process.env.MENDELU_USER && process.env.MENDELU_PASS)) {
  console.error('smoke: --live needs MENDELU_USER and MENDELU_PASS in the environment');
  process.exit(1);
}

const serverArgs = desktopHost
  ? ['scripts/mcp-desktop-host.mjs', 'dist-mcp/server/index.mjs']
  : ['dist-mcp/server/index.mjs'];
const child = spawn(process.execPath, serverArgs, {
  env: {
    ...process.env,
    MENDELU_USER: process.env.MENDELU_USER || 'smoke',
    MENDELU_PASS: process.env.MENDELU_PASS || 'smoke',
  },
  // The desktop host reads its input on fd 3 (see mcp-desktop-host.mjs).
  stdio: ['pipe', 'pipe', 'inherit', 'pipe'],
});
const toServer = desktopHost ? child.stdio[3] : child.stdin;

/** Every exit path goes through here, so the server never outlives the smoke. */
function finish(code, message) {
  if (message) console.error(`smoke: ${message}`);
  child.removeAllListeners('exit');
  child.kill();
  process.exit(code);
}
child.on('exit', (code) => finish(1, `server exited with ${code}`));
toServer.on('error', (e) => finish(1, `server stdin: ${e.message}`));
// Live runs download real files (mendelu_read_file), which takes longer.
const timer = setTimeout(() => finish(1, 'timed out'), live ? 300000 : 90000);

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
    toServer.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n');
  });

await call('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0' },
});
toServer.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const tools = (await call('tools/list', {})).result.tools.map((t) => t.name).sort();
console.log('tools:', tools.length, tools.join(', '));
let failed = tools.length !== 10;

const json = async (name, args) => {
  const r = await call('tools/call', { name, arguments: { ...args, response_format: 'json' } });
  const text = r.result.content[0].text;
  if (r.result.isError) throw new Error(text);
  if (!text.includes('\n\n[truncated at ')) return JSON.parse(text);
  // Only a document's text may run past the character limit. The cut JSON no
  // longer parses, but its kind comes before the text.
  if (name !== 'mendelu_read_file') throw new Error(`${name}: output cut at the limit`);
  return { kind: /"kind": "([^"]+)"/.exec(text)?.[1], truncated: text.length };
};

/** The one refusal a healthy server gives on purpose (files.ts readCapped). */
const TOO_BIG = 'too big to read here';
/** mendelu_subject_files errors that mean "nothing to list", not a broken server. */
const SKIPPABLE_LISTING = ['has no file folder', 'output cut at the limit'];

/**
 * mendelu_read_file takes a downloadUrl, so `{}` proves nothing. IS file names
 * carry no extension, so read the student's own subject files in turn until a
 * PDF and a DOCX have given text. Prints only the kind and the length of the
 * text, never the text or a file name.
 */
async function readRealFiles() {
  const MAX_READS = 25;
  const longest = new Map(); // kind -> longest text read of that kind
  const refusals = [];
  const listingErrors = [];
  let reads = 0;
  const done = () => longest.get('pdf') > 0 && longest.get('docx') > 0;
  outer: for (const s of await json('mendelu_subjects', {})) {
    // Stop before listing another folder once the reads are done.
    if (done() || reads >= MAX_READS) break;
    let files;
    try {
      files = await json('mendelu_subject_files', { code: s.subjectCode });
    } catch (e) {
      const m = e.message.split('\n')[0];
      // Expected: a subject with no IS folder (tools.ts), or a list too long to
      // come back whole. Anything else is a broken listing, which could hide
      // the only DOCX, so it fails the run.
      if (!SKIPPABLE_LISTING.some((s) => m.includes(s))) listingErrors.push(m);
      else console.log(`  a subject's file list was skipped: ${m}`);
      continue;
    }
    for (const f of files) {
      if (done() || reads >= MAX_READS) break outer;
      reads++;
      try {
        const doc = await json('mendelu_read_file', { url: f.downloadUrl });
        const chars = doc.truncated ?? (typeof doc.text === 'string' ? doc.text.length : 0);
        // A scanned file reads as 0 chars; a later file of its kind may still have text.
        if (doc.kind) longest.set(doc.kind, Math.max(longest.get(doc.kind) ?? 0, chars));
      } catch (e) {
        refusals.push(e.message.split('\n')[0]);
      }
    }
  }
  // Unsupported types come back as a note, not an error, so any refusal but
  // the size cap is a broken read (of a file whose kind we never learn).
  const broken = [...listingErrors, ...refusals.filter((m) => !m.includes(TOO_BIG))];
  console.log(`mendelu_read_file: ${reads} files read, ${refusals.length} refused`);
  for (const [kind, chars] of longest) console.log(`  ${kind}: ${chars} chars of text`);
  for (const m of broken) console.log(`  broken read: ${m}`);
  // A PDF is the case that matters; a DOCX only if the student has one.
  return (
    longest.get('pdf') > 0 && (!longest.has('docx') || longest.get('docx') > 0) && !broken.length
  );
}

for (const name of live ? [...extraTools, 'mendelu_exams'] : []) {
  if (name === 'mendelu_read_file') {
    if (!(await readRealFiles())) failed = true;
    continue;
  }
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
