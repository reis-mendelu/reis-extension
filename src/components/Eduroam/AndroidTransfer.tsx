import { Loader2, QrCode, ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onGenerate: () => void;
}

const GETEDUROAM_PLAY_URL = 'https://play.google.com/store/apps/details?id=app.eduroam.geteduroam';

/** Android path: generate .eap-config, upload, show the QR + geteduroam steps. */
export function AndroidTransfer({ status, qrDataUrl, password, onGenerate }: Props) {
  const { t } = useTranslation();

  if (status !== 'done' || !qrDataUrl) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-base-content/70">{t('eduroam.androidIntro')}</p>
        <a
          className="link link-primary text-sm inline-flex items-center gap-1"
          href={GETEDUROAM_PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="w-4 h-4" /> {t('eduroam.getEduroam')}
        </a>
        <button className="btn btn-primary btn-lg gap-2" disabled={status === 'working'} onClick={onGenerate}>
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.androidGenerate')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="alert alert-success text-sm">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{t('eduroam.androidReady')}</span>
      </div>
      <div className="self-center bg-base-200 rounded-box p-4 flex flex-col items-center gap-2">
        <div className="bg-white p-3 rounded-xl">
          <img src={qrDataUrl} alt="eduroam QR" width={220} height={220} />
        </div>
      </div>
      <ul className="steps steps-vertical">
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep0')}</li>
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep1')}</li>
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep2')}</li>
        <li className="step step-primary text-sm text-left">
          <span>
            {t('eduroam.androidStep3')}
            {password && <PasswordChip password={password} />}
          </span>
        </li>
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep4')}</li>
      </ul>
      <button className="btn btn-ghost btn-sm self-start" onClick={onGenerate}>
        {t('eduroam.regenerate')}
      </button>
    </div>
  );
}
