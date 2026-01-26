export function GetIdFromLink(link: string): string | null {
    const match = link.match(/id=(\d+)/);
    return match ? match[1] : null;
}

export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

export function getSmartWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const now = new Date(referenceDate);
    const dayOfWeek = now.getDay();
    let startOfWeek: Date;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
        startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + daysUntilMonday);
    } else {
        startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (dayOfWeek - 1));
    }
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
}
