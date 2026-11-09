import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatPrice, priceRange } from '../../utils/venues/venueText';
import type { Venue, VenueMenuSection } from '../../types/campusMap';

const heading = 'pb-1.5 text-sm font-bold text-base-content';

function MenuItems({ section }: { section: VenueMenuSection }) {
  return (
    <ul
      data-testid="venue-menu-items"
      className="divide-y divide-base-300/70 rounded-xl border border-base-300 px-3"
    >
      {section.items.map((item) => (
        <li key={item.name} className="flex justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 break-words text-base-content">{item.name}</span>
          <span className="shrink-0 font-semibold tabular-nums text-base-content">
            {formatPrice(item.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Chips({ venue, selected, scroll }: { venue: Venue; selected: string; scroll: boolean }) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  const setSection = useAppStore((s) => s.setVenueMenuSection);
  return (
    <div
      role="group"
      aria-label={t('map.venueMenu')}
      className={`flex gap-1.5 ${scroll ? '-mx-1 overflow-x-auto px-1 pb-1' : 'flex-wrap'}`}
    >
      {venue.menu.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={m.id === selected}
          onClick={() => setSection(m.id)}
          className={`btn btn-sm shrink-0 rounded-full ${
            m.id === selected
              ? 'border-primary bg-primary/10 text-base-content'
              : 'btn-outline border-base-300 text-base-content/80'
          }`}
        >
          {m.title[lang]}
        </button>
      ))}
    </div>
  );
}

/**
 * The menu on a venue card. Wide (iPad rail, extension panel): every category
 * as a chip with the open one's items below. Phone: a grid of categories with
 * their price range; a tap opens `VenueMenuPage` in the card's place.
 */
export function VenueMenu({ venue, wide }: { venue: Venue; wide: boolean }) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  const sectionId = useAppStore((s) => s.venueMenuSection);
  const setSection = useAppStore((s) => s.setVenueMenuSection);
  if (venue.menu.length === 0) return null;

  if (wide) {
    const open = venue.menu.find((m) => m.id === sectionId) ?? venue.menu[0]!;
    return (
      <section className="space-y-2">
        <h4 className={heading}>{t('map.venueMenu')}</h4>
        <Chips venue={venue} selected={open.id} scroll={false} />
        <MenuItems section={open} />
      </section>
    );
  }

  return (
    <section>
      <h4 className={heading}>{t('map.venueMenu')}</h4>
      <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3">
        {venue.menu.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSection(m.id)}
            className="min-w-0 rounded-xl border border-base-300 px-3 py-2 text-left transition-colors hover:bg-base-200"
          >
            <span className="block truncate text-sm font-bold text-base-content">
              {m.title[lang]}
            </span>
            <span className="block truncate text-xs text-base-content/70">
              {priceRange(m.items)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** A phone's menu category, opened: back, the other categories, a photo, the items. */
export function VenueMenuPage({
  venue,
  title,
  sectionId,
  footer,
}: {
  venue: Venue;
  title: string;
  sectionId: string;
  footer: ReactNode;
}) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  const setSection = useAppStore((s) => s.setVenueMenuSection);
  const section = venue.menu.find((m) => m.id === sectionId) ?? venue.menu[0]!;
  return (
    <div className="space-y-3" data-testid="venue-menu-page">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSection(null)}
          aria-label={t('map.venueBackToMenu')}
          className="btn btn-ghost btn-circle btn-sm -ml-1"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="truncate text-xs text-base-content/70">
            {t('map.venueMenuOf', { venue: title })}
          </p>
          <h3 className="truncate text-lg font-bold leading-tight text-base-content">
            {section.title[lang]}
          </h3>
        </div>
      </div>
      <Chips venue={venue} selected={section.id} scroll />
      {section.photo && (
        <img
          src={section.photo}
          alt=""
          className="aspect-[16/9] w-full rounded-2xl bg-base-200 object-cover"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <MenuItems section={section} />
      {footer}
    </div>
  );
}
