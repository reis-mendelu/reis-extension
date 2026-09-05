import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileSheet } from '../../../store/types';
import { venueMapChoices } from '../../../utils/venueMapUrl';

type VenueSheetData = Extract<MobileSheet, { kind: 'venue' }>;

export interface VenueSheetProps {
  sheet: VenueSheetData;
  onClose: () => void;
}

/**
 * Which map app takes the student to a venue.
 *
 * Only reached on iOS, and only because iOS gives them no say otherwise:
 * `maps:` opens Apple Maps and nothing asks. Android's `geo:` already produces
 * the system chooser, so `venueMapChoices` returns a single option there and
 * `openVenue` never opens this sheet — a menu that opens a menu is worse than
 * either.
 *
 * The URL is navigated to rather than opened through `openExternal`: Capacitor
 * cancels any top-level navigation that is not the app's own and hands it to
 * the OS, which is what reaches a map APP rather than a map web page.
 */
export function VenueSheet({ sheet, onClose }: VenueSheetProps) {
  const { t } = useTranslation();
  const setPreferred = useAppStore((s) => s.setPreferredMapApp);
  const choices = venueMapChoices(sheet.coord, sheet.label, sheet.platform);
  /**
   * Opt-in, and unticked by default.
   *
   * Remembering silently would be the wrong trade: the sheet is the ONLY place
   * this preference can be reached, so a choice made without meaning to could
   * not be undone from anywhere in the app. Ticking it is the student saying
   * they are done being asked.
   */
  const [remember, setRemember] = useState(false);

  return (
    <Sheet size="content" onClose={onClose} elevated>
      <SheetHeader title={sheet.label || t('map.openInMaps')} onClose={onClose} />
      <div className="flex flex-col gap-2 px-4 pb-6">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => {
              // Persist BEFORE navigating: the navigation hands the WebView to
              // the OS, and anything queued after it may never run.
              if (remember && choice.id !== 'system') void setPreferred(choice.id);
              onClose();
              window.location.href = choice.url;
            }}
            className="flex min-h-12 items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 px-3.5 text-left"
          >
            {choice.id === 'apple' ? (
              <MapPin size={18} className="flex-shrink-0 text-primary" />
            ) : (
              <Navigation size={18} className="flex-shrink-0 text-primary" />
            )}
            <span className="text-md font-medium">{t(choice.labelKey)}</span>
          </button>
        ))}
        {/* Only where there is a choice to remember. On Android the row below
            would promise to stop a question the system, not reIS, is asking. */}
        {choices.length > 1 && (
          <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 px-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="text-sm text-base-content/70">{t('map.rememberChoice')}</span>
          </label>
        )}
      </div>
    </Sheet>
  );
}
