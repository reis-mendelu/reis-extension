import { describe, it, expect } from 'vitest';
import { parseCourseObjectives } from '../objectivesParser';

/**
 * The English syllabus page on is.mendelu.cz, read 2026-11-16 (EBC-VWA,
 * katalog/syllabus.pl?…;lang=en): the heading is "Aim of the course and
 * learning outcomes", singular. The parser knew only "Aims …", so every English
 * syllabus came back without its objectives while the Czech one had them.
 * Markup copied from the real page; the course text is shortened.
 */
const REAL_EN = `<html><body><table><tbody>
<tr class="" ><td class="odsazena" colspan="2" align="left">&nbsp;</td></tr>
<tr class="" ><td class="odsazena" colspan="2" align="left"><b ><span class="nowrap">Aim of the course and learning outcomes: </span></b></td></tr>
<tr class="" ><td class="odsazena" colspan="2" align="left">The course aims to problems of web applications development from theoretical and practical point of view.</td></tr>
</tbody></table></body></html>`;

describe('parseCourseObjectives — English "Aim of the course" label', () => {
  it('reads the objectives under the singular heading IS prints', () => {
    const doc = new DOMParser().parseFromString(REAL_EN, 'text/html');
    expect(parseCourseObjectives(doc)).toBe(
      'The course aims to problems of web applications development from theoretical and practical point of view.'
    );
  });
});
