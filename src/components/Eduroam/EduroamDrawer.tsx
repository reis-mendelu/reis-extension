import { Wifi, Smartphone, Laptop, Tablet, Monitor, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useEduroamSetup, type EduroamTarget } from '../../hooks/data/useEduroamSetup';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { IosTransfer } from './IosTransfer';
import { AndroidTransfer } from './AndroidTransfer';
import { MacInstall } from './MacInstall';
import { WindowsInstall } from './WindowsInstall';

const SEGMENTS: { id: EduroamTarget; labelKey: string; icon: typeof Smartphone }[] = [
  { id: 'ios', labelKey: 'eduroam.targetIos', icon: Smartphone },
  { id: 'android', labelKey: 'eduroam.targetAndroid', icon: Tablet },
  { id: 'mac', labelKey: 'eduroam.targetMac', icon: Laptop },
  { id: 'windows', labelKey: 'eduroam.targetWindows', icon: Monitor },
];

/** Side-drawer host for the eduroam setup flow. Self-connects to the store. */
export function EduroamDrawer() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const isOpen = useAppStore((s) => s.isEduroamOpen);
  const setOpen = useAppStore((s) => s.setIsEduroamOpen);
  const { status, target, selectTarget, password, qrDataUrl, error, run, reset, openProfilesSettings } =
    useEduroamSetup();

  const guideHref = `https://eduroam.mendelu.cz/?lang=${language === 'en' ? 'en' : 'cz'}`;
  const close = () => {
    setOpen(false);
    reset();
  };

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
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        <div role="tablist" className="grid grid-cols-2 gap-2">
          {SEGMENTS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={target === id}
              className={`btn gap-2 ${target === id ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              onClick={() => selectTarget(id)}
            >
              <Icon className="w-4 h-4" /> {t(labelKey)}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <div className="alert alert-error text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t('eduroam.error')}
              {error ? `: ${error}` : ''}
            </span>
          </div>
        )}

        {target === 'ios' && (
          <IosTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('ios')} />
        )}
        {target === 'android' && (
          <AndroidTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('android')} />
        )}
        {target === 'mac' && (
          <MacInstall
            status={status}
            password={password}
            guideHref={guideHref}
            onDownload={() => run('mac')}
            onOpenSettings={openProfilesSettings}
          />
        )}
        {target === 'windows' && (
          <WindowsInstall status={status} password={password} onDownload={() => run('windows')} />
        )}

        <p className="text-xs text-base-content/40">
          {t(target === 'mac' || target === 'windows' ? 'eduroam.privacyNoteLocal' : 'eduroam.privacyNoteTransfer')}
        </p>
      </div>
    </AdaptiveDrawer>
  );
}
