import { describe, it, expect, beforeEach } from 'vitest';
import { parseCourseMetadata } from '../metadataParser';
describe('metadataParser', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should parse Czech metadata correctly', () => {
    const html = `
            <table>
                <tbody>
                    <tr><td>Název předmětu</td><td>Algoritmizace</td></tr>
                    <tr><td>Název předmětu anglicky</td><td>Algorithmization</td></tr>
                    <tr><td>Způsob ukončení</td><td><b>Zkouška</b> (6 kreditů)</td></tr>
                    <tr><td>Garant předmětu</td><td><a href="#">doc. Ing. Oldřich Trenz, Ph.D.</a></td></tr>
                    <tr><td>Vyučující</td><td><a href="#">Ing. Pavel Turčínek, Ph.D.</a> (cvičící)</td></tr>
                    <tr><td>Typ předmětu</td><td>Povinný</td></tr>
                </tbody>
            </table>
        `;
    document.body.innerHTML = html;
    const result = parseCourseMetadata(document, 'cz');

    expect(result.courseName).toBe('Algoritmizace');
    expect(result.credits).toBe('Zkouška');
    expect(result.garant?.name).toBe('doc. Ing. Oldřich Trenz, Ph.D.');
    expect(result.teachers).toHaveLength(1);
    expect(result.teachers[0]!.name).toBe('Ing. Pavel Turčínek, Ph.D.'); // safe: length asserted above
    expect(result.teachers[0]!.roles).toBe('cvičící');
    expect(result.status).toBe('Povinný');
  });

  it('should parse English metadata correctly (Computer Architecture scenario)', () => {
    const html = `
            <table>
                <tbody>
                    <tr><td>Course code:</td><td>EBC-AP</td></tr>
                    <tr><td>Course title in Czech:</td><td>Architektura počítačů</td></tr>
                    <tr><td>Course title in English:</td><td>Computer Architecture</td></tr>
                    <tr><td>Mode of completion and number of credits:</td><td><b>Exam</b> (5 credits)</td></tr>
                    <tr><td>Course type:</td><td>required</td></tr>
                    <tr><td>Type of delivery:</td><td>usual</td></tr>
                    <tr><td>Course supervisor:</td><td>prof. RNDr. Tomáš Pitner, Ph.D.</td></tr>
                </tbody>
            </table>
        `;
    document.body.innerHTML = html;
    const result = parseCourseMetadata(document, 'en');

    expect(result.courseName).toBe('Computer Architecture');
    expect(result.credits).toBe('Exam');
    expect(result.garant?.name).toBe('prof. RNDr. Tomáš Pitner, Ph.D.');
    expect(result.status).toBe('required');
  });

  it('should handle KRED outlier scenario (robust placeholder detection)', () => {
    const html = `
            <table>
                <tbody>
                    <tr><td>Course code:</td><td>KRED</td></tr>
                    <tr><td>Course title in Czech:</td><td>Sport - kredit</td></tr>
                    <tr><td>Course title in English:</td><td>— item not defined —</td></tr> <!-- Em dash -->
                    <tr><td>Mode of completion and number of credits:</td><td>course completion (1 credit)</td></tr>
                    <tr><td>Course type:</td><td>optional</td></tr>
                </tbody>
            </table>
        `;
    document.body.innerHTML = html;
    const result = parseCourseMetadata(document, 'en');

    expect(result.courseName).toBe('Sport - kredit');
    expect(result.credits).toBe('course completion (1 credit)');
  });

  it('should handle missing fields gracefully', () => {
    const html = `<table><tbody><tr><td>Random Row</td><td>Value</td></tr></tbody></table>`;
    document.body.innerHTML = html;
    const result = parseCourseMetadata(document);

    expect(result.credits).toBeNull();
    expect(result.garant).toBeNull();
    expect(result.teachers).toHaveLength(0);
  });
});
