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

    it('ignores stray <font> in unrelated cells and locks onto breadcrumb-bearing cell', () => {
        // An earlier cell has a <font> badge ("Nové") that is NOT the breadcrumb;
        // the parser must skip it and land on the cell whose <font> wraps slozka.pl?id= anchors.
        const row = `<tr>
            <td><input name="oznacene" value="1"></td>
            <td><font size="-2">Nové</font></td>
            <td>The Real Title<br><font size="-2"><a href="slozka.pl?id=17">Inzerce</a> / <a href="slozka.pl?id=78">Ubytování</a></font></td>
            <td><a href="/auth/lide/clovek.pl?id=1">Author</a></td>
            <td>21.05.2026</td>
            <td><a href="slozka.pl?zobrazeni=1;klic=1"><img></a></td>
        </tr>`;
        const html = `<html><body><table id="tmtab_1"><tbody>${row}</tbody></table></body></html>`;
        const posts = parseBulletinHtml(html);
        expect(posts).toHaveLength(1);
        expect(posts[0].title).toBe('The Real Title');
        expect(posts[0].categories).toEqual(['Inzerce', 'Ubytování']);
    });

    it('parses CZ-locale rows that omit the leading ordinal column (6 cells)', () => {
        // Real row markup pulled from a CZ-locale browser session.
        const row = `<tr class=" uis-hl-table lbn">
            <td class="odsazena" align="center"><input type="checkbox" name="oznacene" value="36737"></td>
            <td class="odsazena" align="center"><img src="/img.pl?unid=20555" alt="" sysid="informace-normalni"></td>
            <td class="odsazena" align="left">Hledám parťáka k&nbsp;sobě do pokoje<br><font size="-2"><a href="slozka.pl?id=17">Inzerce</a> / <a href="slozka.pl?id=78">Ubytování</a> / <a href="slozka.pl?id=81">Nabízím</a></font></td>
            <td class="odsazena" nowrap="1" align="left"><a href="/auth/lide/clovek.pl?id=96212">D. Bursík</a></td>
            <td class="odsazena" align="center" nowrap="1">21.05.2026</td>
            <td class="odsazena" align="center"><a href="slozka.pl?zobrazeni=1;id=81;zalozka=1;klic=36737;nove=1"><img src="/img.pl?unid=71073"></a></td>
        </tr>`;
        const html = `<html><body><table id="tmtab_1"><tbody>${row}</tbody></table></body></html>`;
        const posts = parseBulletinHtml(html);
        expect(posts).toHaveLength(1);
        expect(posts[0].title).toBe('Hledám parťáka k sobě do pokoje');
        expect(posts[0].categories).toEqual(['Inzerce', 'Ubytování', 'Nabízím']);
        expect(posts[0].url).toMatch(/klic=36737/);
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
