import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Segmented Student/Society switch. Visible only to a logged-in association; it
// swaps the map between the public view and the society's authoring view.
export function MapModeToggle() {
  const role = useAppStore((s) => s.adminRole);
  const mode = useAppStore((s) => s.mapMode);
  const setMode = useAppStore((s) => s.setMapMode);
  const { t } = useTranslation();
  if (role !== 'association') return null;

  const btn = (key: 'student' | 'society', label: string) => (
    <button
      type="button"
      aria-pressed={mode === key}
      className={`tab gap-1.5 ${mode === key ? 'tab-active font-semibold' : ''}`}
      onClick={() => setMode(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="tabs tabs-box tabs-sm bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      {btn('student', t('map.mode.student'))}
      {btn('society', t('map.mode.society'))}
    </div>
  );
}
