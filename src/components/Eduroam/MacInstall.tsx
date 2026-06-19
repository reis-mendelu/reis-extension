import { Download, ShieldCheck, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import { isMac, type EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  password: string | null;
  onDownload: () => void;
  onOpenSettings: () => void;
}

/** Mac path: download the profile on this Mac and install it via System Settings. */
export function MacInstall({ status, password, onDownload, onOpenSettings }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {!isMac && (
        <div className="alert alert-info text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t('eduroam.macHostHint')}</span>
        </div>
      )}

      {status !== 'done' && (
        <button
          className="btn btn-primary btn-lg gap-2"
          disabled={!isMac || status === 'working'}
          onClick={onDownload}
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
          <ul className="steps steps-vertical">
            <li className="step step-primary text-sm text-left">
              <span>
                {t('eduroam.step1')}
                <button className="btn btn-sm btn-outline gap-2 mt-2 ml-1" onClick={onOpenSettings}>
                  <ExternalLink className="w-4 h-4" />
                  {t('eduroam.openSettings')}
                </button>
              </span>
            </li>
            <li className="step step-primary text-sm text-left">{t('eduroam.step2')}</li>
            <li className="step step-primary text-sm text-left">
              <span>
                {t('eduroam.step3')}
                {password && <PasswordChip password={password} />}
              </span>
            </li>
            <li className="step step-primary text-sm text-left">{t('eduroam.step4')}</li>
          </ul>
          <button className="btn btn-ghost btn-sm self-start" onClick={onDownload}>
            {t('eduroam.regenerate')}
          </button>
        </div>
      )}
    </div>
  );
}
