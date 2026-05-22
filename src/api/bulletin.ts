import { fetchWithAuth, BASE_URL } from './client';
import type { BulletinPost } from '../types/bulletin';

const BULLETIN_URL = `${BASE_URL}/auth/vyveska/nove_prispevky.pl?zalozka=2`;
const BULLETIN_BASE = `${BASE_URL}/auth/vyveska/`;
const MAX_POSTS = 10;

export async function fetchBulletin(): Promise<BulletinPost[]> {
    const response = await fetchWithAuth(BULLETIN_URL);
    const html = await response.text();
    return parseBulletinHtml(html);
}

export function parseBulletinHtml(html: string): BulletinPost[] {
    if (!html || typeof html !== 'string') return [];

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table#tmtab_1');
    if (!table) return [];

    const posts: BulletinPost[] = [];
    const rows = table.querySelectorAll('tbody > tr');
    for (const row of rows) {
        if (posts.length >= MAX_POSTS) break;

        // Locate cells by content, not by column index: CZ locale omits the
        // ordinal column that EN includes, so fixed indices break across locales.
        // Specifically: the title cell is the one whose <font> wraps breadcrumb
        // folder anchors (<a href*="slozka.pl?id=">). Matching on bare <font>
        // would mis-fire on any unrelated <font> tag IS Mendelu might add later.
        const titleCell = Array.from(row.querySelectorAll(':scope > td')).find(c => {
            const font = c.querySelector('font');
            return !!font && !!font.querySelector('a[href*="slozka.pl?id="]');
        });
        if (!titleCell) continue;

        const title = extractTitle(titleCell);
        if (!title) continue;

        const viewAnchor = row.querySelector('a[href*="slozka.pl?zobrazeni="]');
        const href = viewAnchor?.getAttribute('href');
        if (!href) continue;

        const url = href.startsWith('http') ? href : `${BULLETIN_BASE}${href.replace(/^\.?\//, '')}`;
        const categories = extractCategories(titleCell);

        posts.push({ title, categories, url });
    }

    return posts;
}

function extractTitle(cell: Element): string {
    for (const node of Array.from(cell.childNodes)) {
        if (node.nodeType === 1 && (node as Element).tagName === 'BR') break;
        if (node.nodeType === 3) {
            const text = node.textContent?.trim();
            if (text) return text;
        }
    }
    return '';
}

function extractCategories(cell: Element): string[] {
    const font = cell.querySelector('font');
    if (!font) return [];
    return Array.from(font.querySelectorAll('a'))
        .map(a => a.textContent?.trim() ?? '')
        .filter(Boolean);
}
