import { Smartphone, Tablet, Laptop, Monitor, ChevronRight, Check, RotateCcw, type LucideIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { EduroamTutorial } from './EduroamTutorial';
import type { EduroamTarget, EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface DeviceAccordionProps {
  selected: EduroamTarget | null;
  onSelect: (t: EduroamTarget) => void;
  onRestart: () => void;
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onRun: () => void;
  onOpenSettings: () => void;
}

const DEVICES: { id: EduroamTarget; labelKey: string; icon: LucideIcon }[] = [
  { id: 'ios', labelKey: 'eduroam.targetIos', icon: Smartphone },
  { id: 'android', labelKey: 'eduroam.targetAndroid', icon: Tablet },
  { id: 'mac', labelKey: 'eduroam.targetMac', icon: Laptop },
  { id: 'windows', labelKey: 'eduroam.targetWindows', icon: Monitor },
];

export function DeviceAccordion(props: DeviceAccordionProps) {
  const { selected, onSelect, onRestart, ...live } = props;
  const { t } = useTranslation();

  return (
    <div>
      {/* Step 1 heading */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-[13px]">1</span>
        <span className="font-semibold text-[15px] text-base-content/80">{t('eduroam.s1')}</span>
      </div>

      {DEVICES.map(({ id, labelKey, icon: Icon }) => {
        const isSel = selected === id;
        const collapsed = selected !== null && !isSel;
        return (
          <div
            key={id}
            className={`overflow-hidden rounded-2xl transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0 mb-0 -translate-y-2 pointer-events-none' : 'max-h-32 opacity-100 mb-2.5'} ${isSel ? 'ring-2 ring-primary' : ''}`}
          >
            <button
              aria-expanded={isSel}
              onClick={() => onSelect(id)}
              className="flex items-center gap-3.5 w-full p-4 bg-base-100 border border-base-content/10 rounded-2xl text-left"
            >
              <span className={`flex items-center justify-center w-11 h-11 shrink-0 rounded-xl ${isSel ? 'bg-primary/15 text-primary' : 'bg-base-300 text-base-content/70'}`}>
                <Icon className="w-6 h-6" />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-[17px]">{t(labelKey)}</span>
                <span className="block text-[13px] text-base-content/50 mt-0.5">{t(`eduroam.manual.${id}.hint`)}</span>
              </span>
              <span className={`flex items-center justify-center w-6 h-6 shrink-0 ${isSel ? 'text-primary' : 'text-base-content/40'}`}>
                {isSel ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </span>
            </button>
          </div>
        );
      })}

      {selected && (
        <>
          <EduroamTutorial target={selected} {...live} />
          <button onClick={onRestart} className="btn btn-ghost btn-sm gap-2 mx-auto mt-5 flex">
            <RotateCcw className="w-4 h-4" /> {t('eduroam.restart')}
          </button>
        </>
      )}
    </div>
  );
}
