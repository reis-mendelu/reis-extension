// Aliased: bare `Map` shadows the global Map constructor and TS then reads the
// JSX tag as `MapConstructor`.
import { Map as MapIcon } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { mapAppOptions } from '../../../../utils/mapAppOptions';
import { nativeMapPlatform } from '../../../../mobile/nativeMapPlatform';

/**
 * Which map app a venue tap opens: Apple Mapy / Google Maps / Vždy se zeptat.
 *
 * A segmented control, shaped like the Jazyk row above it — NOT a row that is
 * itself a button. It was one `<button>` spanning the width whose `onClick`
 * cleared the preference, rendered only `{preferredMapApp && …}`. Those two
 * facts together made it a control that deleted the reason it was on screen: a
 * tap anywhere, including on the word "Mapy", unmounted the row. Reported as
 * "clicking anywhere on mapy row in the settings makes it disappear".
 *
 * It also read as two controls and was one — the current value and "Vždy se
 * zeptat" sat side by side as separate spans, and neither was the thing you
 * pressed. Now each option is its own button, "ask" is one of them rather than
 * the absence of the row, and the row stays put whichever is on.
 *
 * Renders nothing where there is no choice to make: `mapAppOptions` returns an
 * empty list on Android, whose `geo:` IS the system chooser, and in a browser,
 * which has one URL.
 */
export function MapAppRow() {
  const { t } = useTranslation();
  const preferredMapApp = useAppStore((s) => s.preferredMapApp);
  const setPreferredMapApp = useAppStore((s) => s.setPreferredMapApp);
  // Platform read on every render rather than memoised: it is a synchronous
  // property of the device, and the options depend on the stored preference,
  // which changes under the student's thumb.
  const choices = mapAppOptions(nativeMapPlatform(), preferredMapApp);
  if (choices.length === 0) return null;

  return (
    <div data-testid="map-app-row" className="flex items-center gap-3 px-4 py-2.5">
      <MapIcon size={16} className="flex-shrink-0 text-base-content/50" />
      <span className="min-w-0 flex-1 text-md font-medium">{t('map.mapApp')}</span>
      <div className="join flex-shrink-0">
        {choices.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.selected}
            onClick={() => void setPreferredMapApp(o.id === 'ask' ? null : o.id)}
            className={`join-item btn btn-xs ${o.selected ? 'btn-primary' : 'btn-ghost opacity-60'}`}
          >
            {t(o.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
