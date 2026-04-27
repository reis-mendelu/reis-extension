import type { KontoRow } from '../../../types/iskam';

const ROW_SELECTOR = '.vyskaRiadkuKonto';
const TOP_UP_LABEL_RE = /^(Nab[ií]t|Top[\s-]?up|Charge)$/i;
const BALANCE_RE = /([\d\s,.]+)\s*Kč/;

function parseBalance(text: string): { value: number; raw: string } | null {
    const m = text.match(BALANCE_RE);
    if (!m) return null;
    const raw = m[0].trim();
    const numeric = m[1].replace(/\s/g, '').replace(',', '.');
    const value = Number.parseFloat(numeric);
    if (!Number.isFinite(value)) return null;
    return { value, raw };
}

export function parseKonta(html: string, lang: 'cz' | 'en' = 'cz'): KontoRow[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll(ROW_SELECTOR));
    if (rows.length === 0) return [];

    const out: KontoRow[] = [];
    for (const row of rows) {
        const children = Array.from(row.children) as HTMLElement[];
        if (children.length < 2) continue;

        const name = (children[0].textContent || '').trim();
        const balanceText = (children[1].textContent || '').trim();
        if (!name || !balanceText) continue;

        const parsed = parseBalance(balanceText);
        if (!parsed) continue;

        const topUpAnchor = Array.from(row.querySelectorAll('a')).find(a => TOP_UP_LABEL_RE.test((a.textContent || '').trim()));
        const topUpHref = topUpAnchor?.getAttribute('href') || null;

        const detailAnchor = row.querySelector('a[href*="/Konta/PrevodyUhrady/"]');
        const transactionsHref = detailAnchor?.getAttribute('href') ?? null;

        out.push({
            name,
            nameCs: lang === 'cz' ? name : undefined,
            nameEn: lang === 'en' ? name : undefined,
            balance: parsed.value,
            balanceText: parsed.raw,
            topUpHref,
            transactionsHref,
        });
    }
    return out;
}
