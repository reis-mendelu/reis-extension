import type { Building } from '../../types/campusMap';
import { translate } from '../../i18n/translate';
import { floorText } from '../../components/CampusMap/floorText';
import { floorHeights, nearestCorner } from './isoFloors';
import { isoPixel } from './isoView';

/**
 * What names the open floor on the building itself: counted from the ground (so a building that numbers
 * its ground floor 1 still says "2. patro" for floor 3, which is what its B2xx rooms say), at the nearest
 * corner of the open floor.
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

/** The floor the way a student says it: "4. patro", "přízemí". Never up or down: nobody knows which floor they start from. */
export function cueText(up: number, language: Lang): string {
  return floorText(up, (key, params) => translate(language, key, params));
}
