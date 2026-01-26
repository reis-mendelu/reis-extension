export function validateCourseCode(code: string): boolean {
    return /^[A-Z]{2,4}-[A-Z]{2,4}-[A-Z]{3,5}\d+-\d{4}$/.test((code || '').trim());
}

export function validateRoomCode(room: string): boolean {
    return /^[A-Z]{1,2}\d{1,4}[a-z]?$/.test((room || '').trim());
}

export function validateUrl(url: string, domain: string = 'is.mendelu.cz'): string {
    if (!url || typeof url !== 'string') return '';
    try {
        const abs = url.startsWith('/') ? `https://${domain}${url}` : (!url.startsWith('http') ? `https://${domain}/${url}` : url);
        const p = new URL(abs);
        return (p.protocol === 'https:' && p.hostname.endsWith(domain)) ? abs : '';
    } catch { return ''; }
}
