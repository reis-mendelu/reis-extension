import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { FloorStack } from '../../../CampusMap/FloorStack';

/**
 * Chrome shown only while drilled into a building: a "whole campus" back pill
 * (desktop exits a floor by clicking the bare map, which mobile has no margin
 * for) and the floor list (reusing the same `FloorStack` the desktop floor
 * picker uses, unchanged). Both float directly on the map, so — like the
 * room/building labels Leaflet draws straight onto the basemap (src/index.css)
 * — the back pill uses fixed colour literals instead of base-* theme tokens:
 * a themed pill would vanish against the light basemap in light theme.
 *
 * z-[1000] matches CampusMapView's desktop chrome: Leaflet's own controls sit
 * at z-index 1000 internally, and MapCanvas doesn't isolate that away, so
 * anything meant to float above the map here has to clear the same bar.
 */
export function FloorSwitcher() {
    const activeBuildingId = useAppStore((s) => s.activeBuildingId);
    const exitToCampus = useAppStore((s) => s.exitToCampus);
    const { t } = useTranslation();
    if (activeBuildingId === null) return null;

    return (
        <>
            <button
                type="button"
                onClick={exitToCampus}
                className="absolute left-4 top-[76px] z-[1000] flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold backdrop-blur-md"
                style={{
                    background: 'rgba(31,41,55,.94)',
                    border: '1px solid rgba(243,244,246,.1)',
                    color: '#f3f4f6',
                }}
            >
                <ArrowLeft size={14} aria-hidden="true" />
                {t('mobile.map.wholeCampus')}
            </button>
            <div className="absolute bottom-[190px] right-3 z-[1000]">
                <FloorStack />
            </div>
        </>
    );
}
