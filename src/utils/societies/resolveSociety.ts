import type { FacultyKey, Society } from '../../types/events';

export const NEUTRAL_SOCIETY_COLOR = '#6b7280';

/** Tile text for a society without a logo: short names whole, long ones abbreviated. */
export function glyphFor(shortName: string): string {
  const trimmed = shortName.trim();
  if (trimmed.length <= 4) return trimmed;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.length <= 4 ? first : first.slice(0, 2).toUpperCase();
}

/**
 * What an id the catalog does not know renders as. Grey, no logo, campus-wide.
 *
 * It used to be ESN. With a catalog that arrives over the network, a cache
 * older than a newly added society is normal, and falling back to ESN would
 * brand that society's events as somebody else's.
 */
export function neutralSociety(id: string): Society {
  return {
    id,
    name: id,
    shortName: id,
    color: NEUTRAL_SOCIETY_COLOR,
    glyph: glyphFor(id),
    facultyKey: 'mendelu',
    autoFollowFaculty: false,
    audienceLabel: null,
    sortOrder: Number.MAX_SAFE_INTEGER,
    isActive: false,
  };
}

export function resolveSociety(catalog: Record<string, Society>, id: string): Society {
  return catalog[id] ?? neutralSociety(id);
}

/** The societies a student or admin can pick from: active, in catalog order. */
export function listedSocieties(catalog: Record<string, Society>): Society[] {
  return Object.values(catalog)
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** The society new students of this faculty follow by default, if any. */
export function autoFollowSocietyFor(
  catalog: Record<string, Society>,
  facultyKey: FacultyKey
): string | null {
  const hit = Object.values(catalog).find(
    (s) => s.isActive && s.autoFollowFaculty && s.facultyKey === facultyKey
  );
  return hit?.id ?? null;
}

export function toSocietyRecord(list: Society[]): Record<string, Society> {
  return Object.fromEntries(list.map((s) => [s.id, s]));
}
