export * from './validation/stringSanitizer';
export * from './validation/domainValidators';
export * from './validation/dateValidators';

export function validateFileName(filename: string): string {
    if (!filename || typeof filename !== 'string') return '';
    const safe = filename.replace(/\.\./g, '').replace(/[/\\]/g, '');
    const sanitized = safe.replace(/[^a-zA-Z0-9\s.\-_áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, '');
    return sanitized.slice(0, 300).trim();
}
