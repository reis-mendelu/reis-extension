import { useState } from 'react';
import { Wifi, Download, ShieldCheck, Copy, Check, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useEduroamSetup } from '../../hooks/data/useEduroamSetup';

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

export function EduroamSetup() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const { status, password, error, run, openProfilesSettings, embedsPassword } = useEduroamSetup();
  const [copied, setCopied] = useState(false);

  const guideHref = `https://eduroam.mendelu.cz/?lang=${language === 'en' ? 'en' : 'cz'}`;

  const copyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still read the password */
    }
  };

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

        {!isMac && (
          <div className="alert alert-info text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t('eduroam.macOnly')}{' '}
              <a className="link" href={guideHref} target="_blank" rel="noopener noreferrer">
                {t('eduroam.openGuide')}
              </a>
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="alert alert-error text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('eduroam.error')}{error ? `: ${error}` : ''}</span>
          </div>
        )}

        {status !== 'done' && (
          <button
            className="btn btn-primary btn-lg gap-2"
            disabled={!isMac || status === 'working'}
            onClick={run}
          >
            {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {status === 'working' ? t('eduroam.preparing') : t('eduroam.download')}
          </button>
        )}

        {status === 'done' && (
          <div className="flex flex-col gap-4">
            <div className="alert alert-success text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{t('eduroam.downloaded')}</span>
            </div>
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                {t('eduroam.step1')}
                <button className="btn btn-sm btn-outline gap-2 mt-2 ml-1" onClick={openProfilesSettings}>
                  <ExternalLink className="w-4 h-4" />
                  {t('eduroam.openSettings')}
                </button>
              </li>
              <li>{t('eduroam.step2')}</li>
              {!embedsPassword && (
                <li>
                  {t('eduroam.step3')}
                  {password && (
                    <button className="btn btn-sm btn-ghost font-mono gap-2 mt-2 ml-1" onClick={copyPassword}>
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      {password}
                    </button>
                  )}
                </li>
              )}
              <li>{t('eduroam.step4')}</li>
            </ol>
            <button className="btn btn-ghost btn-sm self-start" onClick={run}>
              {t('eduroam.regenerate')}
            </button>
          </div>
        )}

        <p className="text-xs text-base-content/40">{t('eduroam.privacyNote')}</p>
      </div>
    </div>
  );
}
