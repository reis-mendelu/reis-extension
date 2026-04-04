import { describe, it, expect } from 'vitest';
import { parseExamData } from './parsers/exams';

describe('examParser', () => {
    it('parses deregistration deadline with standard <br> tags', () => {
        const html = `
            <html><body>
            <table id="table_1"><tbody>
            <tr>
                <td></td><td>1.</td><td>CODE</td><td>Subject</td><td></td>
                <td>01.01.2026 10:00</td><td>Room</td><td>zkouška</td><td>Teacher</td>
                <td>10/10</td><td>Regular</td>
                <td>--<br>01.01.2026 09:00<br>31.12.2025 23:59</td>
                <td>Info</td><td>Unregister</td>
            </tr>
            </tbody></table>
            </body></html>
        `;
        const result = parseExamData(html);
        const term = result[0].sections[0].registeredTerm;
        expect(term?.deregistrationDeadline).toBe('31.12.2025 23:59');
    });

    it('parses deregistration deadline with self-closing <br /> tags', () => {
        const html = `
            <html><body>
            <table id="table_1"><tbody>
            <tr>
                <td></td><td>1.</td><td>CODE</td><td>Subject</td><td></td>
                <td>01.01.2026 10:00</td><td>Room</td><td>zkouška</td><td>Teacher</td>
                <td>10/10</td><td>Regular</td>
                <td>--<br />01.01.2026 09:00<br />31.12.2025 23:59</td>
                <td>Info</td><td>Unregister</td>
            </tr>
            </tbody></table>
            </body></html>
        `;
        const result = parseExamData(html);
        const term = result[0].sections[0].registeredTerm;
        expect(term?.deregistrationDeadline).toBe('31.12.2025 23:59');
    });

    it('parses all three registration fields from available terms', () => {
        const html = `
            <html><body>
            <table id="table_2"><tbody>
            <tr>
                <td></td><td>1.</td><td>CODE</td><td>Subject</td><td></td>
                <td>01.01.2026 10:00</td><td>Room</td><td>zkouška</td><td>Teacher</td>
                <td>5/20</td><td>Regular</td>
                <td>15.12.2025 08:00<br>31.12.2025 23:59<br>28.12.2025 23:59</td>
                <td>Info</td>
            </tr>
            </tbody></table>
            </body></html>
        `;
        const result = parseExamData(html);
        const term = result[0].sections[0].terms[0];
        expect(term.registrationStart).toBe('15.12.2025 08:00');
        expect(term.registrationEnd).toBe('31.12.2025 23:59');
        expect(term.deregistrationDeadline).toBe('28.12.2025 23:59');
    });

    it('parses available term with -- for registration start', () => {
        const html = `
            <html><body>
            <table id="table_2"><tbody>
            <tr>
                <td></td><td>1.</td><td>CODE</td><td>Subject</td><td></td>
                <td>01.01.2026 10:00</td><td>Room</td><td>zkouška</td><td>Teacher</td>
                <td>5/20</td><td>Regular</td>
                <td>--<br>16.02.2026 11:00<br>16.02.2026 11:00</td>
                <td>Info</td>
            </tr>
            </tbody></table>
            </body></html>
        `;
        const result = parseExamData(html);
        const term = result[0].sections[0].terms[0];
        expect(term.registrationStart).toBeUndefined();
        expect(term.registrationEnd).toBe('16.02.2026 11:00');
        expect(term.deregistrationDeadline).toBe('16.02.2026 11:00');
    });

    it('parses deregistration deadline with mixed <br> tags', () => {
        const html = `
            <html><body>
            <table id="table_1"><tbody>
            <tr>
                <td></td><td>1.</td><td>CODE</td><td>Subject</td><td></td>
                <td>01.01.2026 10:00</td><td>Room</td><td>zkouška</td><td>Teacher</td>
                <td>10/10</td><td>Regular</td>
                <td>--<br>01.01.2026 09:00<br/>31.12.2025 23:59</td>
                <td>Info</td><td>Unregister</td>
            </tr>
            </tbody></table>
            </body></html>
        `;
        const result = parseExamData(html);
        const term = result[0].sections[0].registeredTerm;
        expect(term?.deregistrationDeadline).toBe('31.12.2025 23:59');
    });
});
