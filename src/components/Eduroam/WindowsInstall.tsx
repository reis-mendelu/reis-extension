import { Download, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  password: string | null;
  onDownload: () => void;
}

const GETEDUROAM_WINDOWS_URL = 'https://www.geteduroam.app/';

/** Windows path: download the .eap-config on this PC and open it in geteduroam. */
export function WindowsInstall({ status, password, onDownload }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <a
        className="link link-primary text-sm inline-flex items-center gap-1"
        href={GETEDUROAM_WINDOWS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink className="w-4 h-4" /> {t('eduroam.getEduroamWindows')}
      </a>

      {status !== 'done' && (
        <button
          className="btn btn-primary btn-lg gap-2"
          disabled={status === 'working'}
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
            <span>{t('eduroam.windowsDownloaded')}</span>
          </div>
          <ul className="steps steps-vertical">
            <li className="step step-primary text-sm text-left">{t('eduroam.windowsStep0')}</li>
            <li className="step step-primary text-sm text-left">{t('eduroam.windowsStep1')}</li>
            <li className="step step-primary text-sm text-left">
              <span>
                {t('eduroam.windowsStep2')}
                {password && <PasswordChip password={password} />}
              </span>
            </li>
            <li className="step step-primary text-sm text-left">{t('eduroam.windowsStep3')}</li>
          </ul>
          <button className="btn btn-ghost btn-sm self-start" onClick={onDownload}>
            {t('eduroam.regenerate')}
          </button>
        </div>
      )}
    </div>
  );
}
