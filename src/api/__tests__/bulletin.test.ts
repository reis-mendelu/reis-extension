import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBulletinHtml } from '../bulletin';

const FIXTURE = readFileSync(
    join(__dirname, 'fixtures', 'vyveska.html'),
    'utf-8',
);

describe('parseBulletinHtml', () => {
    it('returns empty for missing or malformed input', () => {
        expect(parseBulletinHtml('')).toEqual([]);
        expect(parseBulletinHtml('<html><body><p>no table</p></body></html>')).toEqual([]);
    });

    it('parses contributions from a real nove_prispevky fixture', () => {
        const posts = parseBulletinHtml(FIXTURE);
        expect(posts.length).toBeGreaterThanOrEqual(5);
        expect(posts.length).toBeLessThanOrEqual(10);

        const first = posts[0];
        expect(first.title.length).toBeGreaterThan(0);
        expect(first.url).toMatch(/slozka\.pl\?/);
        expect(first.categories.length).toBeGreaterThan(0);
    });

    it('caps results at 10 posts even if more rows exist', () => {
        const rows = Array.from({ length: 20 }, (_, i) => `
            <tr>
                <td><small></small></td>
                <td><input name="oznacene" value="${1000 + i}"></td>
                <td><img sysid="informace-normalni"></td>
                <td>Title ${i}<br><font size="-2"><a href="slozka.pl?id=1">Inzerce</a> / <a href="slozka.pl?id=2">Nabízím</a></font></td>
                <td><a href="/auth/lide/clovek.pl?id=1">A. B.</a></td>
                <td>01/01/2026</td>
                <td><a href="slozka.pl?zobrazeni=1;klic=${1000 + i}"><img></a></td>
            </tr>`).join('');
        const html = `<html><body><table id="tmtab_1"><tbody>${rows}</tbody></table></body></html>`;
        const posts = parseBulletinHtml(html);
        expect(posts).toHaveLength(10);
        expect(posts[0].title).toBe('Title 0');
        expect(posts[0].categories).toEqual(['Inzerce', 'Nabízím']);
        expect(posts[0].url).toMatch(/klic=1000/);
    });

    it('skips rows with fewer than 7 cells', () => {
        const html = `<html><body><table id="tmtab_1"><tbody>
            <tr><td>1</td><td>2</td><td>3</td></tr>
        </tbody></table></body></html>`;
        expect(parseBulletinHtml(html)).toEqual([]);
    });

    it('skips rows with empty title or no view link', () => {
        const html = `<html><body><table id="tmtab_1"><tbody>
            <tr>
                <td></td><td></td><td></td>
                <td><br><font><a href="slozka.pl?id=1">Cat</a></font></td>
                <td></td><td></td><td></td>
            </tr>
        </tbody></table></body></html>`;
        expect(parseBulletinHtml(html)).toEqual([]);
    });
});
