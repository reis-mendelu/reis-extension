export function timeToMinutes(time: string): number {
    const parts = time.split(":");
    return parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0;
}

export function timeToMinutesDefault(time: string): number {
    const parts = time.split(".");
    return parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0;
}

export function minutesToTimeDefault(time: number): string {
    const totalMinutes = time % 1440;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}.${String(minutes).padStart(2, '0')}`;
}

export function getSubjectLength(start: string, end: string) {
    const diff = timeToMinutesDefault(end) - timeToMinutesDefault(start);
    return Math.ceil(diff / 60);
}
