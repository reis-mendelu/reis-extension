// Pure geometry for off-screen edge indicators — no DOM, fully unit-tested.

export interface Point { x: number; y: number; }
export interface Rect { width: number; height: number; }
export interface EdgeAnchor { x: number; y: number; angle: number; }

// Given the viewport center, a target's screen point, the container size, and
// an edge padding, return the clamped point on the padded rect edge along the
// ray center->target plus the angle (radians, atan2(dy,dx)) toward the target.
// Returns null when the target lies inside the padded box (i.e. on-screen).
export function edgeAnchor(center: Point, target: Point, rect: Rect, pad: number): EdgeAnchor | null {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const halfW = Math.min(center.x, rect.width - center.x) - pad;
  const halfH = Math.min(center.y, rect.height - center.y) - pad;
  if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return null;
  const angle = Math.atan2(dy, dx);
  const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: center.x + dx * t, y: center.y + dy * t, angle };
}

export interface LandmarkPoint { id: number; name: string; lat: number; lon: number; }
export interface Cluster { ids: number[]; lat: number; lon: number; label: string; }

function distMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function clusterLabel(names: string[]): string {
  if (names.length === 1) return names[0];
  let prefix = names[0];
  for (const n of names.slice(1)) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  prefix = prefix.replace(/\s+\S*$/, '').trim(); // drop a partial trailing word
  return prefix.length >= 3 ? prefix : `${names.length} places`;
}

// Greedy single-pass clustering: a point joins the first existing cluster whose
// running centroid is within thresholdMeters, else starts a new one. Centroid
// is the mean of member coords. Good enough for ~8 landmarks.
export function clusterLandmarks(points: LandmarkPoint[], thresholdMeters: number): Cluster[] {
  const groups: { pts: LandmarkPoint[]; lat: number; lon: number }[] = [];
  for (const p of points) {
    const g = groups.find((grp) => distMeters(grp.lat, grp.lon, p.lat, p.lon) <= thresholdMeters);
    if (g) {
      g.pts.push(p);
      g.lat = g.pts.reduce((s, q) => s + q.lat, 0) / g.pts.length;
      g.lon = g.pts.reduce((s, q) => s + q.lon, 0) / g.pts.length;
    } else {
      groups.push({ pts: [p], lat: p.lat, lon: p.lon });
    }
  }
  return groups.map((g) => ({
    ids: g.pts.map((q) => q.id),
    lat: g.lat,
    lon: g.lon,
    label: clusterLabel(g.pts.map((q) => q.name)),
  }));
}
