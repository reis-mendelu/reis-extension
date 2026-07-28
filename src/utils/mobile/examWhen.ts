/** Midnight of the day `d` falls on. */
function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday 00:00 of the week `d` falls in. Czech weeks start on Monday, which is
 *  what "tento týden" means to a student looking at an exam schedule. */
export function startOfWeek(d: Date): Date {
    const day = startOfDay(d);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return day;
}

export function isSameWeek(a: Date, b: Date): boolean {
    return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** "08:00" → "8:00". IS pads the hour; the design does not. */
export function trimHour(time: string): string {
    return time.replace(/^0/, '');
}

/**
 * "út 21. 7." — short weekday, then day and month with the Czech trailing dots.
 *
 * The weekday comes from `Intl`, so Czech gets "út" and English "Tue" without a
 * hand-maintained name table. The numeric part is built by hand rather than
 * with `toLocaleDateString`, because every locale renders the separators its
 * own way and this layout is fixed by the design.
 */
export function formatDayMonth(date: Date, locale: string): string {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
        .format(date)
        .replace(/\.$/, '');
    return `${weekday} ${date.getDate()}. ${date.getMonth() + 1}.`;
}

/** The strip's lead line: "dnes · 15:00" when it is today, else "út 21. 7. · 8:00". */
export function formatWhenShort(date: Date, time: string, now: Date, locale: string, todayLabel: string): string {
    const clock = trimHour(time);
    return isSameDay(date, now) ? `${todayLabel} · ${clock}` : `${formatDayMonth(date, locale)} · ${clock}`;
}

/** The list row's right column: "po 27. 7. 9:00" — no separator before the time. */
export function formatWhenRow(date: Date, time: string, locale: string): string {
    return `${formatDayMonth(date, locale)} ${trimHour(time)}`;
}

/** Splits registered exams into this calendar week and everything after it.
 *  Anything already past stays in `thisWeek` if it falls in the current week —
 *  the group is "this week", not "still to come". */
export function splitByWeek<T>(items: T[], dateOf: (item: T) => Date, now: Date): { thisWeek: T[]; later: T[] } {
    const thisWeek: T[] = [];
    const later: T[] = [];
    for (const item of items) {
        (isSameWeek(dateOf(item), now) ? thisWeek : later).push(item);
    }
    return { thisWeek, later };
}
