export async function resolveFinalFileUrl(link: string): Promise<string> {
    link = link.replace(/\?;/g, '?').replace(/;/g, '&');
    const auth = "https://is.mendelu.cz/auth", root = "https://is.mendelu.cz";

    if (link.includes('dokumenty_cteni.pl')) {
        const n = link.replace(/;/g, '&').replace(/\?/g, '&'), i = n.match(/[&]id=(\d+)/), d = n.match(/[&]dok=(\d+)/);
        if (i && d) return `${auth}/dok_server/slozka.pl?download=${d[1]}&id=${i[1]}&z=1`;
    }

    let full = link.startsWith('http') ? link : (link.startsWith('/') ? root + link : `${auth}/dok_server/${link}`);

    if (!full.includes('download=')) {
        try {
            const res = await fetch(full, { credentials: 'include' }), doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            const a = Array.from(doc.querySelectorAll('a')).find(x => x.href.includes('download=') && x.querySelector('img[sysid]'));
            if (a) {
                const h = a.getAttribute('href');
                if (h) {
                    if (h.startsWith('http')) { full = h; if (full.includes('dokumenty_cteni.pl') && !full.includes('/auth/')) full = full.replace('is.mendelu.cz/dokumenty_cteni.pl', 'is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl'); }
                    else if (h.startsWith('/')) full = h.includes('dokumenty_cteni.pl') ? `${auth}/dok_server${h}` : root + h;
                    else full = `${auth}/dok_server/${h}`;
                }
            }
        } catch (e) { console.warn(e); }
    }
    return full;
}
