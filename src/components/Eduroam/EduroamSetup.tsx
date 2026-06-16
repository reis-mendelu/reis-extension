import { Wifi, Smartphone, Laptop, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useEduroamSetup } from '../../hooks/data/useEduroamSetup';
import { IosTransfer } from './IosTransfer';
import { MacInstall } from './MacInstall';

export function EduroamSetup() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const { status, target, selectTarget, password, qrDataUrl, error, run, openProfilesSettings } =
    useEduroamSetup();

  const guideHref = `https://eduroam.mendelu.cz/?lang=${language === 'en' ? 'en' : 'cz'}`;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('eduroam.title')}</h1>
            <p className="text-sm text-base-content/60">{t('eduroam.subtitle')}</p>
          </div>
        </div>

        <div role="tablist" className="tabs tabs-boxed">
          <button
            role="tab"
            className={`tab gap-2 ${target === 'ios' ? 'tab-active' : ''}`}
            onClick={() => selectTarget('ios')}
          >
            <Smartphone className="w-4 h-4" /> {t('eduroam.targetIos')}
          </button>
          <button
            role="tab"
            className={`tab gap-2 ${target === 'mac' ? 'tab-active' : ''}`}
            onClick={() => selectTarget('mac')}
          >
            <Laptop className="w-4 h-4" /> {t('eduroam.targetMac')}
          </button>
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

        {target === 'ios' ? (
          <IosTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('ios')} />
        ) : (
          <MacInstall
            status={status}
            password={password}
            guideHref={guideHref}
            onDownload={() => run('mac')}
            onOpenSettings={openProfilesSettings}
          />
        )}

        <p className="text-xs text-base-content/40">{t('eduroam.privacyNote')}</p>
      </div>
    </div>
  );
}
