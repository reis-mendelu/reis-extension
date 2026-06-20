import { useState } from 'react';
import { Wifi, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useEduroamSetup, type EduroamTarget } from '../../hooks/data/useEduroamSetup';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { DeviceAccordion } from './DeviceAccordion';

/** Side-drawer host for the eduroam setup flow. Self-connects to the store. */
export function EduroamDrawer() {
  const { t } = useTranslation();
  const isOpen = useAppStore((s) => s.isEduroamOpen);
  const setOpen = useAppStore((s) => s.setIsEduroamOpen);
  const { status, password, qrDataUrl, error, run, reset, selectTarget, openProfilesSettings } = useEduroamSetup();
  const [selected, setSelected] = useState<EduroamTarget | null>(null);

  const close = () => { setOpen(false); setSelected(null); reset(); };
  const onSelect = (tg: EduroamTarget) => { setSelected(tg); selectTarget(tg); };
  const onRestart = () => { setSelected(null); reset(); };
  const isLocal = selected === 'mac' || selected === 'windows';

  return (
    <AdaptiveDrawer open={isOpen} onClose={close} width="sm:w-[560px]" title={t('eduroam.title')}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-base-300">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Wifi className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{t('eduroam.title')}</h3>
          <p className="text-xs text-base-content/50 truncate">{t('eduroam.subtitle')}</p>
        </div>
        <button onClick={close} aria-label="Close" className="btn btn-ghost btn-xs btn-circle">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* Hero */}
        <div className="mb-7">
          <h1 className="font-extrabold text-[28px] leading-tight tracking-tight text-balance">{t('eduroam.heroTitle')}</h1>
          <p className="text-[15px] text-base-content/70 mt-2 max-w-[38ch]">{t('eduroam.heroSub')}</p>
        </div>

        {status === 'error' && (
          <div className="alert alert-error text-sm mb-5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('eduroam.error')}{error ? `: ${error}` : ''}</span>
          </div>
        )}

        <DeviceAccordion
          selected={selected}
          onSelect={onSelect}
          onRestart={onRestart}
          status={status}
          qrDataUrl={qrDataUrl}
          password={password}
          onRun={() => selected && run(selected)}
          onOpenSettings={openProfilesSettings}
        />

        {selected && (
          <p className="text-xs text-base-content/40 mt-6">
            {t(isLocal ? 'eduroam.privacyNoteLocal' : 'eduroam.privacyNoteTransfer')}
          </p>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-base-content/[0.07] text-center">
          <div className="font-semibold text-[13px] text-base-content/70">{t('eduroam.footer')}</div>
          <div className="text-xs text-base-content/40 mt-1">{t('eduroam.footerSub')}</div>
        </div>
      </div>
    </AdaptiveDrawer>
  );
}
