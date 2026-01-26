export const CDN_BASE_URL = "https://raw.githubusercontent.com/darksoothingshadow/reis-data/main";

export async function checkCDNAvailability(code: string) {
    const url = `${CDN_BASE_URL}/subjects/${code}.json`;
    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return { code, status: 'ok', message: `✅ ${code} exists` };
        return { code, status: res.status === 404 ? 'missing' : 'error', message: res.status === 404 ? `❌ 404` : `⚠️ ${res.status}` };
    } catch (e) { return { code, status: 'error', message: `⚠️ ${e}` }; }
}

export const batchCheckCDN = (codes: string[]) => Promise.all(codes.map(checkCDNAvailability));
