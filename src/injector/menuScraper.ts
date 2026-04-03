import type { PageCategory, PageItem } from '../data/pages/types';

const BASE_URL = 'https://is.mendelu.cz';

const ICON_MAP: Record<string, string> = {
    'info': 'Info',
    'spiral-bound-booklet': 'GraduationCap',
    'glass-jar': 'Microscope',
    'learning': 'Monitor',
    'group-message': 'Calendar',
    'writing-down': 'FileText',
    'device-manager': 'Cpu',
    'save': 'Shield',
    'lifebuoy': 'HelpCircle',
    'slot-machine': 'Gamepad2',
    'cog': 'Settings',
    'computer-support': 'Wrench',
    'blocked-account-male': 'Lock',
    'favorite': 'Star',
};

interface RawCategory {
    id: string;
    label: string;
    icon: string;
    children: { id: string; label: string; href: string }[];
}

function slugify(href: string): string {
    return href
        .replace(/^\/auth\//, '')
        .replace(/\?.*/g, '')
        .replace(/\.pl$/, '')
        .replace(/\/+$/, '')
        .replace(/[/_]/g, '-')
        || 'unknown';
}

function resolveHref(raw: string): string {
    const url = raw.startsWith('/') ? `${BASE_URL}${raw}` : raw;
    return url.replace(/[?;&]_m=\d+/g, '').replace(/\?$/, '');
}

function parseSection(section: Element): RawCategory | null {
    const handle = section.querySelector('.menu-drzak');
    if (!handle) return null;

    const label = handle.getAttribute('title')?.trim() || '';
    if (!label) return null;

    const id = section.id || `section-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const iconSvg = section.querySelector('.polozky-obr svg[data-sysid]');
    const sysId = iconSvg?.getAttribute('data-sysid') || '';
    const icon = ICON_MAP[sysId] || 'Link';

    const children: RawCategory['children'] = [];
    const links = section.querySelectorAll('.polozky ul li a');
    for (const a of links) {
        const rawHref = a.getAttribute('href');
        if (!rawHref || rawHref.startsWith('javascript:')) continue;
        const text = a.textContent?.trim() || '';
        if (!text) continue;

        children.push({ id: slugify(rawHref), label: text, href: resolveHref(rawHref) });
    }

    if (children.length === 0) return null;
    return { id, label, icon, children };
}

function scrapeRaw(doc: Document): RawCategory[] | null {
    const container = doc.getElementById('vsechny-polozky');
    if (!container) return null;

    const sections = container.querySelectorAll('.polozky-obal');
    if (sections.length === 0) return null;

    const categories: RawCategory[] = [];
    for (const section of sections) {
        // Skip "My favourites" — user-customized duplicates of other menu items
        if (section.id === 'sekce-61') continue;
        const cat = parseSection(section);
        if (cat) categories.push(cat);
    }
    return categories.length > 0 ? categories : null;
}

function detectLang(doc: Document): 'cz' | 'en' {
    const meta = doc.querySelector('meta[name="lang"]');
    const lang = meta?.getAttribute('content')?.toLowerCase();
    return lang === 'en' ? 'en' : 'cz';
}

function mergeDual(primary: RawCategory[], primaryLang: 'cz' | 'en', secondary: RawCategory[] | null): PageCategory[] {
    return primary.map(cat => {
        const other = secondary?.find(s => s.id === cat.id);
        const isCz = primaryLang === 'cz';

        const children: PageItem[] = cat.children.map(child => {
            const otherChild = other?.children.find(c => c.id === child.id);
            return {
                id: child.id,
                label: isCz ? child.label : (otherChild?.label ?? child.label),
                labelEn: isCz ? (otherChild?.label ?? child.label) : child.label,
                href: child.href,
            };
        });

        return {
            id: cat.id,
            label: isCz ? cat.label : (other?.label ?? cat.label),
            labelEn: isCz ? (other?.label ?? cat.label) : cat.label,
            icon: cat.icon,
            expandable: true,
            children,
        };
    });
}

export function scrapeNavMenu(doc: Document): { categories: RawCategory[]; lang: 'cz' | 'en' } | null {
    const categories = scrapeRaw(doc);
    if (!categories) return null;

    const lang = detectLang(doc);
    return { categories, lang };
}

export async function fetchOtherLanguage(currentLang: 'cz' | 'en'): Promise<RawCategory[] | null> {
    const otherLang = currentLang === 'cz' ? 'en' : 'cz';
    try {
        const res = await fetch(`${BASE_URL}/auth/?lang=${otherLang}`, { credentials: 'include' });
        if (!res.ok) return null;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const result = scrapeRaw(doc);
        return result;
    } catch {
        return null;
    }
}

export { mergeDual };
