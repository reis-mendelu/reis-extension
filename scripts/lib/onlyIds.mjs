// `--only=<id,id,…>` for the dev scripts that rewrite a committed map-data file
// (fetch-landmarks.mjs, fetch-remote-places.mjs). Absent → null, a full run.
// Anything else malformed throws before a single request: a bare `--only` used
// to read as absent and regenerate every hand-trimmed outline, and an unknown
// id to fetch nothing and report success.
export function parseOnlyIds(argv, knownIds) {
  const args = argv.filter((a) => a === '--only' || a.startsWith('--only='));
  if (args.length === 0) return null;
  if (args.length > 1) throw new Error('--only given more than once');
  const list = args[0].slice('--only='.length);
  if (!args[0].startsWith('--only=') || list === '') {
    throw new Error('--only needs ids: --only=-108,-109');
  }
  const known = new Set(knownIds);
  return list.split(',').map((raw) => {
    const id = raw.trim() === '' ? NaN : Number(raw);
    if (!Number.isInteger(id)) throw new Error(`--only: "${raw}" is not an id`);
    if (!known.has(id)) throw new Error(`--only: no place with id ${id} in this script`);
    return id;
  });
}
