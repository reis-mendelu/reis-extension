import { useTranslation } from '../../../../hooks/useTranslation';

export interface DayChipsProps {
    /** Monday of the fetched week; when the schedule hasn't loaded one yet, falls back to the selected day's own week. */
    weekStart: Date | null;
    selectedIso: string;
    onSelect: (iso: string) => void;
}

function toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y as number, (m as number) - 1, d as number);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date;
}

/** Five weekday chips (Mon–Fri), the row that lets a student jump to another day of the fetched week. */
export function DayChips({ weekStart, selectedIso, onSelect }: DayChipsProps) {
    const { language } = useTranslation();
    const locale = language === 'en' ? 'en-US' : 'cs-CZ';
    const monday = weekStart ?? mondayOf(selectedIso);

    const days = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return date;
    });

    return (
        <div className="flex flex-shrink-0 gap-1.5 px-4 pb-2.5 pt-4">
            {days.map((date) => {
                const iso = toIso(date);
                const isSelected = iso === selectedIso;
                const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
                const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
                return (
                    <button
                        key={iso}
                        type="button"
                        onClick={() => onSelect(iso)}
                        className={`flex-1 rounded-full py-2 text-center text-sm transition-colors ${
                            isSelected
                                ? 'bg-primary font-semibold text-primary-content'
                                : 'font-medium text-base-content/70'
                        }`}
                    >
                        {label} {date.getDate()}
                    </button>
                );
            })}
        </div>
    );
}
