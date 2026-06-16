import { Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onGenerate: () => void;
}

/** iPhone / iPad path: encrypt + upload happen in the hook; here we show the QR + steps. */
export function IosTransfer({ status, qrDataUrl, password, onGenerate }: Props) {
  const { t } = useTranslation();

  if (status !== 'done' || !qrDataUrl) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-base-content/70">{t('eduroam.iosIntro')}</p>
        <button className="btn btn-primary btn-lg gap-2" disabled={status === 'working'} onClick={onGenerate}>
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.iosGenerate')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="alert alert-success text-sm">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{t('eduroam.iosReady')}</span>
      </div>
      <div className="self-center bg-white p-3 rounded-xl">
        <img src={qrDataUrl} alt="eduroam QR" width={240} height={240} />
      </div>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>{t('eduroam.iosStep1')}</li>
        <li>{t('eduroam.iosStep2')}</li>
        <li>
          {t('eduroam.iosStep3')}
          {password && <PasswordChip password={password} />}
        </li>
        <li>{t('eduroam.iosStep4')}</li>
      </ol>
      <button className="btn btn-ghost btn-sm self-start" onClick={onGenerate}>
        {t('eduroam.regenerate')}
      </button>
    </div>
  );
}
