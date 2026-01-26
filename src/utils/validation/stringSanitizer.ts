export function sanitizeString(input: unknown, maxLength = 500): string {
    if (typeof input !== 'string') return '';
    const stripped = input.replace(/<[^>]*>/g, '');
    const safe = stripped.replace(/[<>"'\\]/g, '').split(String.fromCharCode(0)).join('');
    return safe.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function sanitizeTeacherName(name: string): string {
    const sanitized = sanitizeString(name, 200);
    return !/[a-zA-ZáčďéěíňóřšťúůýžÁČĎĚÍŇÓŘŠŤÚŮÝŽ]/.test(sanitized) ? '' : sanitized;
}
