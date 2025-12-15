import { describe, it, expect } from 'vitest';
import { parseExamData } from './examParser';

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
