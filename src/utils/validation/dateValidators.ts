export function validateDate(str: string): Date | null {
    let d = new Date(str);
    if (isNaN(d.getTime())) {
        const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m) d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    }
    if (isNaN(d.getTime())) return null;
    const now = new Date(), min = new Date(now.getFullYear() - 2, 0, 1), max = new Date(now.getFullYear() + 2, 11, 31);
    return (d < min || d > max) ? null : d;
}
