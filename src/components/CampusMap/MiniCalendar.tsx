import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toISO, parseISO, monthMatrix, addMonths } from './calendar';

const DOW = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export function MiniCalendar({ value, onChange, placeholder, t, locale }: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder: string;
  t: (k: string) => string;
  locale: string;
}) {
  const parsed = value ? parseISO(value) : null;
  const [view, setView] = useState(() => parsed ?? { y: new Date().getFullYear(), m0: new Date().getMonth() });
  const [open, setOpen] = useState(false);
  const label = value ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : placeholder;
  const monthLabel = new Date(view.y, view.m0, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <div className="dropdown w-full">
      <button
        type="button" tabIndex={0}
        className={`input input-bordered flex w-full items-center gap-2 ${value ? '' : 'text-base-content/50'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Calendar size={16} className="opacity-70" />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div tabIndex={0} className="dropdown-content z-[70] mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-3 shadow-popover-heavy">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-xs" aria-label={t('map.prevMonth')} onClick={() => setView((v) => addMonths(v.y, v.m0, -1))}><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold capitalize">{monthLabel}</span>
            <button type="button" className="btn btn-ghost btn-xs" aria-label={t('map.nextMonth')} onClick={() => setView((v) => addMonths(v.y, v.m0, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-base-content/50">
            {DOW.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthMatrix(view.y, view.m0).flat().map((d, i) => {
              if (d === null) return <span key={i} />;
              const iso = toISO(view.y, view.m0, d);
              const sel = iso === value;
              return (
                <button
                  key={i} type="button"
                  className={`btn btn-ghost btn-xs h-8 w-8 p-0 tabular-nums ${sel ? 'btn-primary' : ''}`}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >{d}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
