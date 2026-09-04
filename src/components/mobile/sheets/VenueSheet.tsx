import { MapPin, Navigation } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
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
  const choices = venueMapChoices(sheet.coord, sheet.label, sheet.platform);

  return (
    <Sheet size="content" onClose={onClose} elevated>
      <SheetHeader title={sheet.label || t('map.openInMaps')} onClose={onClose} />
      <div className="flex flex-col gap-2 px-4 pb-6">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => {
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
      </div>
    </Sheet>
  );
}
