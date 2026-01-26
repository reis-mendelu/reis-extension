import { format, isSameMonth, isSameDay, isToday } from 'date-fns';
import { cs } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DatePickerCalendar({ currentDate, setCurrentDate, weeks, availableDates, otherRegisteredDates, selectedDate, onSelectDate }: any) {
    const daysOfWeek = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
    return (
        <div className="p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700 capitalize">{format(currentDate, 'LLLL', { locale: cs })}</span>
                <div className="flex gap-0.5">
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500"><ChevronLeft size={14} /></button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500"><ChevronRight size={14} /></button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-0">{daysOfWeek.map((d, i) => <div key={i} className="h-6 flex items-center justify-center text-[10px] font-medium text-slate-400 uppercase">{d}</div>)}</div>
            <div className="flex flex-col">
                {weeks.map((week: any, wi: number) => (
                    <div key={wi} className="grid grid-cols-7">
                        {week.map((day: Date) => {
                            const dateInfo = availableDates.find((d: any) => isSameDay(d.date, day));
                            const hasAvailable = !!dateInfo && !dateInfo.isFull;
                            const isSel = dateInfo && selectedDate === dateInfo.dateStr;
                            const other = otherRegisteredDates.find((d: any) => isSameDay(d.date, day));
                            return (
                                <div key={day.toString()} className={`flex flex-col items-center justify-start relative ${other ? 'h-12' : 'h-8'}`}>
                                    <button onClick={() => hasAvailable && onSelectDate(dateInfo.dateStr)} disabled={!hasAvailable}
                                            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all relative
                                            ${isSel ? 'bg-primary text-white font-bold shadow-sm' : hasAvailable ? 'bg-primary text-white font-bold hover:bg-primary/80 shadow-sm' : dateInfo?.isFull ? 'text-slate-300 line-through' : isToday(day) ? 'bg-slate-100 ring-2 ring-slate-400 text-slate-700 font-semibold' : isSameMonth(day, currentDate) ? 'text-slate-400' : 'text-slate-200'}`}>
                                        {format(day, 'd')}
                                    </button>
                                    {other && <div className="text-[7px] text-error font-medium mt-0.5 max-w-[32px] truncate text-center" title={other.label}>{other.label.split(' - ')[0]}</div>}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
