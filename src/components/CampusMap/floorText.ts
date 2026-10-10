type T = (key: string, params?: Record<string, string | number>) => string;

/**
 * The way a student says the floor, not the map's raw level: Q4.03 is on level 3,
 * which is "3. patro" (and 4.NP on the door). "Podlaží 3" would contradict the
 * room's own name, because podlaží counts the ground floor as the first.
 */
export function floorText(level: number | null, t: T): string {
  if (level === null) return '–';
  if (level === 0) return t('map.floorGround');
  return level > 0 ? t('map.floorAbove', { n: level }) : t('map.floorBelow', { n: -level });
}
