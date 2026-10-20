import { translate } from '../../i18n/translate';
import type { NewPoint } from './newPoints';

const SHOWN = 3;

/**
 * The text of the one notification a sync batch gets: the subject and what was
 * added when it is one subject, the subjects' names when it is several.
 */
export function newPointsNotification(
  found: Record<string, NewPoint[]>,
  nameOf: (courseCode: string) => string,
  language: string
): { title: string; body: string } {
  const codes = Object.keys(found);
  if (codes.length !== 1) {
    return {
      title: translate(language, 'zaznamnik.notifyTitleMany'),
      body: codes.map(nameOf).join(', '),
    };
  }
  const [code] = codes as [string];
  const points = found[code] ?? [];
  const listed = points.slice(0, SHOWN).map((p) => `${p.label}: ${p.value}`);
  if (points.length > SHOWN) listed.push('…');
  return {
    title: translate(language, 'zaznamnik.notifyTitleOne', { subject: nameOf(code) }),
    body: listed.join(', '),
  };
}
