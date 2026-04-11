import { describe, it, expect } from 'vitest';
import { parseCourseObjectives } from '../objectivesParser';
import { parseCourseContent } from '../contentParser';

// Fixture derived from real IS Mendelu syllabus HTML (EBC-MT, fetched 2026-04-11)
const REAL_STRUCTURE_HTML = `
<html><body>
<table><tbody>
  <tr><td class="odsazena" colspan="2"><b><span class="nowrap">Cíl předmětu a&nbsp;studijní výstupy: </span></b></td></tr>
  <tr><td class="odsazena" colspan="2">Student dosáhne takových matematických znalostí a&nbsp;dovedností, které jsou potřebné k&nbsp;řešení základních problémů v&nbsp;ekonomických disciplínách.</td></tr>

  <tr><td class="odsazena" colspan="2"><b><span class="nowrap">Obsah předmětu: </span></b></td></tr>
  <tr><td class="odsazena" colspan="2">
    <table><tbody>
      <tr>
        <td class="odsazena" valign="top"><b>1.</b></td>
        <td class="odsazena"><b>Principy matematického uvažování</b> (dotace 2/2)</td>
      </tr>
      <tr>
        <td class="odsazena">&nbsp;</td>
        <td class="odsazena">
          <table><tbody>
            <tr><td class="odsazena" valign="top">a.</td><td class="odsazena">Matematická symbolika</td></tr>
            <tr><td class="odsazena" valign="top">b.</td><td class="odsazena">Množinové operace</td></tr>
          </tbody></table>
        </td>
      </tr>
      <tr>
        <td class="odsazena" valign="top"><b>2.</b></td>
        <td class="odsazena"><b>Lineární algebra</b> (dotace 6/12)</td>
      </tr>
      <tr>
        <td class="odsazena">&nbsp;</td>
        <td class="odsazena">
          <table><tbody>
            <tr><td class="odsazena" valign="top">a.</td><td class="odsazena">Matice a operace s nimi</td></tr>
            <tr><td class="odsazena" valign="top">b.</td><td class="odsazena">Determinant</td></tr>
          </tbody></table>
        </td>
      </tr>
    </tbody></table>
  </td></tr>
</tbody></table>
</body></html>
`;

// English variant label
const ENGLISH_HTML = `
<html><body>
<table><tbody>
  <tr><td class="odsazena" colspan="2"><b><span class="nowrap">Aims of the course and learning outcomes: </span></b></td></tr>
  <tr><td class="odsazena" colspan="2">Students will develop mathematical knowledge and skills required for solving problems in economic disciplines.</td></tr>

  <tr><td class="odsazena" colspan="2"><b><span class="nowrap">Course content: </span></b></td></tr>
  <tr><td class="odsazena" colspan="2">
    <table><tbody>
      <tr>
        <td class="odsazena" valign="top"><b>1.</b></td>
        <td class="odsazena"><b>Linear algebra</b> (dotace 6/12)</td>
      </tr>
      <tr>
        <td class="odsazena">&nbsp;</td>
        <td class="odsazena">
          <table><tbody>
            <tr><td class="odsazena" valign="top">a.</td><td class="odsazena">Matrices and operations</td></tr>
          </tbody></table>
        </td>
      </tr>
    </tbody></table>
  </td></tr>
</tbody></table>
</body></html>
`;

const MISSING_HTML = `<html><body><table><tbody>
  <tr><td><b>Požadavky na ukončení:</b></td></tr>
  <tr><td>Zkouška</td></tr>
</tbody></table></body></html>`;

function parse(html: string) {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('parseCourseObjectives', () => {
  it('extracts Czech objectives text', () => {
    const doc = parse(REAL_STRUCTURE_HTML);
    const result = parseCourseObjectives(doc);
    expect(result).toContain('Student dosáhne');
    expect(result).toContain('ekonomických disciplínách');
  });

  it('extracts English objectives text', () => {
    const doc = parse(ENGLISH_HTML);
    const result = parseCourseObjectives(doc);
    expect(result).toContain('Students will develop');
  });

  it('returns null when section is absent', () => {
    const doc = parse(MISSING_HTML);
    expect(parseCourseObjectives(doc)).toBeNull();
  });
});

describe('parseCourseContent', () => {
  it('extracts numbered chapters with sub-topics', () => {
    const doc = parse(REAL_STRUCTURE_HTML);
    const result = parseCourseContent(doc);
    expect(result).not.toBeNull();
    expect(result).toContain('1. Principy matematického uvažování');
    expect(result).toContain('a. Matematická symbolika');
    expect(result).toContain('b. Množinové operace');
    expect(result).toContain('2. Lineární algebra');
    expect(result).toContain('a. Matice a operace s nimi');
  });

  it('strips (dotace N/N) from chapter titles', () => {
    const doc = parse(REAL_STRUCTURE_HTML);
    const result = parseCourseContent(doc);
    expect(result).not.toContain('dotace');
  });

  it('extracts English content', () => {
    const doc = parse(ENGLISH_HTML);
    const result = parseCourseContent(doc);
    expect(result).toContain('1. Linear algebra');
    expect(result).toContain('a. Matrices and operations');
  });

  it('returns null when section is absent', () => {
    const doc = parse(MISSING_HTML);
    expect(parseCourseContent(doc)).toBeNull();
  });
});
