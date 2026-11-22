// Serves the isometric map's tile folders for local development, with CORS so the dev
// webapp on another port can fetch them. Nothing is hosted: this listens on localhost.
//   node dev/serveIsoTiles.mjs ~/izomapa-brno/site/tiles_small  (512 px tiles; port 8793, or ISO_TILES_PORT)
//   VITE_ISO_MAP_URL=http://localhost:8793 npm run dev:web
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = process.argv[2] ?? join(homedir(), 'izomapa-brno', 'site', 'tiles_small');
const root = resolve(arg.startsWith('~') ? join(homedir(), arg.slice(1)) : arg);
const port = Number(process.env.ISO_TILES_PORT ?? 8793);
// Only the exact shape of a tile URL is served, and the file path is built from the
// captured parts, never from the raw request: /<season>/<level>/<col>_<row>.webp
const TILE = /^\/(summer|autumn|winter|spring|lights)\/(\d{1,2})\/(\d{1,3})_(\d{1,3})\.webp$/;

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const m = TILE.exec((req.url ?? '').split('?')[0] ?? '');
  if (!m) return void res.writeHead(404).end();
  const file = join(root, m[1], m[2], `${m[3]}_${m[4]}.webp`);
  try {
    const size = statSync(file).size;
    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Content-Length': size,
      'Cache-Control': 'public, max-age=3600',
    });
    // A file that vanishes between stat and read must end the response, not crash the server.
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`iso tiles: ${root} on http://localhost:${port}`));
