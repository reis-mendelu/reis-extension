// Serves the isometric map's tile folders for local development, with CORS so the dev
// webapp on another port can fetch them. Nothing is hosted: this listens on localhost.
//   node dev/serveIsoTiles.mjs ~/izomapa-brno/site/tiles        (port 8793, or ISO_TILES_PORT)
//   VITE_ISO_MAP_URL=http://localhost:8793 npm run dev:web
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const arg = process.argv[2] ?? join(homedir(), 'izomapa-brno', 'site', 'tiles');
const root = resolve(arg.startsWith('~') ? join(homedir(), arg.slice(1)) : arg);
const port = Number(process.env.ISO_TILES_PORT ?? 8793);
const types = { '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'));
  const file = join(root, path);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (file !== root && !file.startsWith(root + sep)) return void res.writeHead(403).end();
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'public, max-age=3600',
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`iso tiles: ${root} on http://localhost:${port}`));
