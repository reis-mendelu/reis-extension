import { Clock, MapPin } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatPrice } from '../../utils/venues/venueText';
import type { PizzeriaMenu } from '../../types/menuTypes';

const TIME_RANGE = /(\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})/;

/**
 * The pizzeria as a tab of the Jídelníček, on both trees (student suggestion
 * #39): when it is open first — the question before "what" — then the pizzas
 * with the student price, as SKM's "Pizzerie" tab lists them.
 *
 * The hours are SKM's own lines, shown as written: the page words them freely
 * and differently per language, so reIS does not parse them into "open now".
 */
export function PizzeriaMenuTab({
  pizzeria,
  variant,
}: {
  pizzeria: PizzeriaMenu;
  variant: 'sheet' | 'popover';
}) {
  const { t } = useTranslation();
  const sheet = variant === 'sheet';
  const card = sheet
    ? 'rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5'
    : 'rounded-lg border border-base-300 px-3 py-2';
  const text = sheet ? 'text-md' : 'text-xs';

  return (
    <div data-testid="menu-pizzeria" className={`flex flex-col gap-2 ${sheet ? '' : 'p-3'}`}>
      <div className={`${card} ${sheet ? 'text-sm' : 'text-xs'} text-base-content`}>
        <p className="flex items-center gap-2 font-bold">
          <Clock
            size={sheet ? 16 : 14}
            className="flex-shrink-0 text-base-content/40"
            aria-hidden
          />
          {t('menu.pizzeriaHours')}
        </p>
        <ul className="mt-1 space-y-0.5 pl-6">
          {pizzeria.hours.map((line) => (
            <li key={line} className="break-words">
              {/* A time range stays whole: "10:30 - 14:30" broke after the dash. */}
              {line.split(TIME_RANGE).map((part, i) =>
                i % 2 ? (
                  <span key={i} className="whitespace-nowrap">
                    {part}
                  </span>
                ) : (
                  part
                )
              )}
            </li>
          ))}
        </ul>
        {pizzeria.address && (
          <p className="mt-1.5 flex items-center gap-2 text-base-content/70">
            <MapPin size={sheet ? 16 : 14} className="flex-shrink-0 text-primary" aria-hidden />
            {pizzeria.address}
          </p>
        )}
      </div>

      {/* 24 pizzas would make the sheet's one grid cell (MenuOutletPanel) as tall as
          the list for EVERY tab, leaving the canteens a screen of blank. The list
          scrolls inside a fixed height instead; a cut-off row says it does. */}
      <ul
        data-testid="pizza-list"
        // Focusable so a keyboard user can scroll past the first few pizzas.
        tabIndex={0}
        aria-label={t('menu.pizzeriaOffer')}
        className={`divide-y divide-base-300 overflow-y-auto overscroll-contain ${card} !py-0 max-h-60`}
      >
        {pizzeria.pizzas.map((p) => (
          <li key={p.name} className={`flex items-start gap-3 py-2 ${text} text-base-content`}>
            <span className="min-w-0 flex-1 break-words">{p.name}</span>
            <span className="flex-shrink-0 font-bold tabular-nums">{formatPrice(p.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
