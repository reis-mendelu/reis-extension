export interface KontrolaData {
    datumNarozeni: string; // ISO date: "YYYY-MM-DD"
}

function parseDDMMYYYY(raw: string): string | null {
    // Input: "03.10.2004 (DD.MM.RRRR)" or "03.10.2004"
    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

export async function fetchKontrolaData(): Promise<KontrolaData | null> {
    try {
        const res = await fetch('https://is.mendelu.cz/auth/kontrola/?lang=cz');
        if (!res.ok) return null;

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.getElementById('tmtab_1');
        if (!table) return null;

        const rows = table.getElementsByTagName('tr');
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length < 2) continue;
            const label = (cells[0].textContent ?? '').replace(/\u00a0/g, ' ').trim();
            if (label === 'Datum narození') {
                const raw = cells[1].textContent?.trim() ?? '';
                const iso = parseDDMMYYYY(raw);
                if (iso) return { datumNarozeni: iso };
            }
        }
        return null;
    } catch (e) {
        console.error('[kontrola] fetch error:', e);
        return null;
    }
}

export function formatDatumNarozeni(iso: string, language: 'cs' | 'en'): string {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}
