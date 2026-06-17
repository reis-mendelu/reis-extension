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
      <div className="self-center bg-white p-3 rounded-xl">
        <img src={qrDataUrl} alt="eduroam QR" width={240} height={240} />
      </div>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>{t('eduroam.androidStep0')}</li>
        <li>{t('eduroam.androidStep1')}</li>
        <li>{t('eduroam.androidStep2')}</li>
        <li>
          {t('eduroam.androidStep3')}
          {password && <PasswordChip password={password} />}
        </li>
        <li>{t('eduroam.androidStep4')}</li>
      </ol>
      <button className="btn btn-ghost btn-sm self-start" onClick={onGenerate}>
        {t('eduroam.regenerate')}
      </button>
    </div>
  );
}
