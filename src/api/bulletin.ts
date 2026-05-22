import { fetchWithAuth, BASE_URL } from './client';
import type { BulletinPost } from '../types/bulletin';

const BULLETIN_URL = `${BASE_URL}/auth/vyveska/index.pl`;

// Navigation/UI strings that are not post titles
const SKIP_TEXTS = new Set(['další', 'more', 'předchozí', 'previous', 'přidat inzerát', 'add notice', 'vývěska', 'bulletin board', 'odebrat', 'remove', 'zpět', 'back']);

export async function fetchBulletin(): Promise<BulletinPost[]> {
    const response = await fetchWithAuth(BULLETIN_URL);
    const html = await response.text();
    return parseBulletinHtml(html);
}

export function parseBulletinHtml(html: string): BulletinPost[] {
    if (!html || typeof html !== 'string') return [];

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const posts: BulletinPost[] = [];
    const seen = new Set<string>();

    // The dedicated Vývěska page contains only post links — no section hunting needed.
    // IS Mendelu post hrefs contain "vyveska" in the path.
    const links = doc.querySelectorAll('a[href]');
    for (const link of links) {
        const rawText = link.textContent?.trim() ?? '';
        if (!rawText || rawText.length < 5) continue;
        if (SKIP_TEXTS.has(rawText.toLowerCase())) continue;

        const href = link.getAttribute('href') ?? '';
        if (!href || !href.includes('vyveska')) continue;
        if (seen.has(href)) continue;
        seen.add(href);

        const url = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        const parentText = link.parentElement?.textContent ?? '';
        const categories = extractCategories(parentText, rawText);

        posts.push({ title: rawText, categories, url });
    }

    return posts;
}

function extractCategories(parentText: string, linkText: string): string[] {
    const afterLink = parentText.substring(parentText.indexOf(linkText) + linkText.length);
    const match = afterLink.match(/\(([^)]+)\)/);
    if (!match) return [];
    return match[1].split('/').map(c => c.trim()).filter(Boolean);
}
