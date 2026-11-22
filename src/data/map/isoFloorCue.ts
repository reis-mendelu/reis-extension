import type { Building } from '../../types/campusMap';
import { translate } from '../../i18n/translate';
import { floorText } from '../../components/CampusMap/floorText';
import { floorHeights, nearestCorner } from './isoFloors';
import { isoPixel } from './isoView';

/**
 * What says "you are here" on the building itself. The open floor is named the way a student says it
 * and counted in floors up from the ground (so a building that numbers its ground floor 1 still says
 * "2 floors up" for floor 3). The label sits at the nearest corner of the open floor.
 */
export function floorCue(b: Pick<Building, 'id' | 'floors' | 'outline'>, level: number) {
  const { baseM, floorM, lowest } = floorHeights(b);
  const at = (l: number) => baseM + (l - lowest) * floorM;
  const [lng, lat] = nearestCorner(b.outline.coordinates[0]!);
  return {
    up: level - lowest,
    corner: isoPixel(lat, lng, at(level)),
  };
}

type Lang = 'cz' | 'cs' | 'en';

/** "4. patro" and "4 patra nahoru": the floor, then what to do about it (nothing, on the ground floor). */
export function cueText(up: number, language: Lang): { title: string; action: string | null } {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(language, key, params);
  const n = Math.abs(up);
  const form =
    language === 'en' ? (n === 1 ? 'One' : 'Many') : n === 1 ? 'One' : n <= 4 ? 'Few' : 'Many';
  return {
    title: floorText(up, t),
    action: up === 0 ? null : t(`map.iso${up > 0 ? 'Up' : 'Down'}${form}`, { n }),
  };
}
