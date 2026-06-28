// Faux "social" layer for campus-map society events — the going / interested
// counts shown on the detail card. We're still in the mock-data design phase:
// there is no attendance backend yet, so this synthesises stable, plausible
// numbers from the event id. Everything is DETERMINISTIC (seeded by the id) so a
// card shows the same "65 going" on every render and across reloads, instead of
// flickering. Swap socialFor() for a real fetch when the backend lands.

export interface EventSocial {
  /** Base "going" count (excludes the current user — the UI adds +1 when you RSVP going). */
  going: number;
  interested: number;
}

// FNV-1a — tiny, stable string hash. We only need spread, not crypto strength.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic faux attendance for an event. Same id → same numbers. */
export function socialFor(eventId: string): EventSocial {
  const h = hash(eventId);
  const going = 8 + (h % 180);            // 8–187 going
  const interested = 3 + ((h >>> 3) % 40); // 3–42 interested
  return { going, interested };
}
