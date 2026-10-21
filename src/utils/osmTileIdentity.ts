// What OpenStreetMap's tile servers are told about who is asking, in Firefox.
//
// OSM blocks tile traffic it cannot attribute to an app, and the block is a 403
// image on every tile. Chrome's half is a declarativeNetRequest rule
// (public/osm-tile-identity.rules.json); the phone apps append the same string
// to their WebView User-Agent (capacitor.config.ts). The Firefox build is MV2,
// which has no declarativeNetRequest, so its background page appends it with a
// blocking webRequest listener instead — see src/entrypoints/background.ts.
//
// Unlike the static Chrome rule, this one is scoped exactly: it only touches a
// tile that one of reIS's own pages loaded, never another site's or another
// extension's.

/** The one identifier every platform sends. The guard test holds the others to it. */
export const OSM_TILE_IDENTITY = 'reIS/5 (+https://github.com/reis-mendelu/reis-extension)';

/** Matched by the listener, contained/requested by the in-map banner. */
export const OSM_TILE_ORIGINS = ['https://tile.openstreetmap.org/*'];

interface TileRequest {
  requestHeaders?: chrome.webRequest.HttpHeader[];
  /** Firefox: the document the request belongs to. */
  documentUrl?: string;
  /** Firefox: what triggered the request. */
  originUrl?: string;
}

/**
 * The headers to send instead, or undefined to leave the request alone.
 * `extensionOrigin` is `runtime.getURL('')`, e.g. `moz-extension://<uuid>/`.
 */
export function identifyTileRequest(
  req: TileRequest,
  extensionOrigin: string
): chrome.webRequest.HttpHeader[] | undefined {
  const ours = [req.documentUrl, req.originUrl].some((u) => u?.startsWith(extensionOrigin));
  if (!ours || !req.requestHeaders) return undefined;
  const i = req.requestHeaders.findIndex((h) => h.name.toLowerCase() === 'user-agent');
  const current = i === -1 ? undefined : req.requestHeaders[i]?.value;
  if (current?.includes(OSM_TILE_IDENTITY)) return undefined;
  // Append, never replace: the browser half must stay truthful, and OSM rejects
  // spoofed identification. webRequest inserts no separator, so add one.
  const value = current ? `${current} ${OSM_TILE_IDENTITY}` : OSM_TILE_IDENTITY;
  const headers = [...req.requestHeaders];
  if (i === -1) headers.push({ name: 'User-Agent', value });
  else headers[i] = { name: headers[i]!.name, value };
  return headers;
}
