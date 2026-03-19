import { X, Newspaper } from 'lucide-react';
import { createPortal } from 'react-dom';
import { EventItem } from './EventItem';
import { useEventsFacultySettings } from '../../hooks/useEventsFacultySettings';
import { useTranslation } from '../../hooks/useTranslation';
import { useIsMobile } from '../../hooks/ui/useIsMobile';
import type { MendeluEvent } from '../../types/events';
import { ALL_FACULTY_KEYS, ORGANIZERS } from '../../types/events';

interface EventsDropdownProps {
  events: MendeluEvent[];
  loading: boolean;
  onClose: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

function FacultyFilters() {
  const { isSubscribed, toggleFaculty } = useEventsFacultySettings();

  return (
    <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-base-300">
      {ALL_FACULTY_KEYS.map(key => {
        const org = ORGANIZERS[key];
        const active = isSubscribed(key);
        return (
          <button
            key={key}
            onClick={() => toggleFaculty(key)}
            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
              active
                ? 'text-white border-transparent'
                : 'text-base-content/50 border-base-300 bg-transparent hover:border-base-content/30'
            }`}
            style={active ? { backgroundColor: org.color } : undefined}
          >
            {key.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export function EventsDropdown({ events, loading, onClose, dropdownRef }: EventsDropdownProps) {
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();

  const today = new Date();
  const dayName = today.toLocaleDateString(language === 'en' ? 'en-US' : 'cs-CZ', { weekday: 'long' });
  const dateStr = `${language === 'en' ? dayName : dayName.toLowerCase()} ${today.getDate()}.${today.getMonth() + 1}.`;

  const content = (
    <>
      <FacultyFilters />
      {loading && events.length === 0 ? (
        <div className="p-4 text-center text-base-content/60">{t('events.loading')}</div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center text-base-content/60">
          <Newspaper size={48} className="mx-auto mb-2 opacity-40" />
          <p>{t('events.empty')}</p>
        </div>
      ) : (
        <div className="divide-y divide-base-300">
          {events.map((e, i) => (
            <EventItem key={`${e.url}-${i}`} event={e} onClick={() => { window.open(e.url, '_blank'); onClose(); }} />
          ))}
        </div>
      )}
    </>
  );

  if (isMobile) {
    return createPortal(
      <div ref={dropdownRef} className="fixed inset-0 z-50 bg-base-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="font-semibold text-lg text-base-content whitespace-nowrap overflow-hidden">
            {t('events.title')} <span className="opacity-40 font-normal ml-1">- {dateStr}</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-base-300 rounded ml-2 flex-shrink-0"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{content}</div>
      </div>,
      document.body
    );
  }

  return (
    <div ref={dropdownRef} className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[400px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <h3 className="font-semibold text-lg text-base-content whitespace-nowrap overflow-hidden">
          {t('events.title')} <span className="opacity-40 font-normal ml-1">- {dateStr}</span>
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-base-300 rounded ml-2 flex-shrink-0"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">{content}</div>
    </div>
  );
}
