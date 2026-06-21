import { useState, type ReactNode } from 'react';
import { Loader2, QrCode, Download, ExternalLink, Check, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import { StepHeading } from './StepHeading';
import { EDUROAM_MANUAL, manualKey, type EduroamAction } from './manual';
import type { EduroamTarget, EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface EduroamTutorialProps {
  target: EduroamTarget;
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onRun: () => void;
  onOpenSettings: () => void;
}

/** A numbered step row: badge + connector line + content column. The final
 *  row passes `done` to show a green check instead of a number. */
function NumberedRow({ n, last, done, children }: { n?: number; last: boolean; done?: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-3.5 mb-4">
      <div className="flex flex-col items-center shrink-0">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${done ? 'bg-success text-success-content' : 'bg-base-100 border border-base-content/10'}`}>
          {done ? <Check className="w-4 h-4" /> : n}
        </span>
        {!last && <div className="w-px flex-1 bg-gradient-to-b from-base-content/15 to-transparent mt-1 min-h-2" />}
      </div>
      <div className="flex-1 pb-1 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function ActionButton({ action, status, onRun, onOpenSettings }: {
  action: EduroamAction; status: EduroamStatus; onRun: () => void; onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const working = status === 'working';
  if (action === 'openSettings') {
    return (
      <button className="btn btn-primary btn-sm gap-2" onClick={onOpenSettings}>
        <ExternalLink className="w-4 h-4" /> {t('eduroam.openSettings')}
      </button>
    );
  }
  const Icon = action === 'qr' ? QrCode : Download;
  return (
    <button className="btn btn-primary btn-sm gap-2" disabled={working} onClick={onRun}>
      {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {working ? t('eduroam.preparing') : action === 'qr' ? t('eduroam.createQr') : t('eduroam.download')}
    </button>
  );
}

export function EduroamTutorial({ target, status, qrDataUrl, password, onRun, onOpenSettings }: EduroamTutorialProps) {
  const { t } = useTranslation();
  const manual = EDUROAM_MANUAL[target];
  const [zoom, setZoom] = useState<string | null>(null);
  // Phone screenshots are shown smaller so they don't dominate the panel
  // (desktop captures stay wide); tap-to-zoom gives full detail either way.
  const phone = target === 'ios' || target === 'android';

  return (
    <div className="mt-6">
      {/* Step 2 heading */}
      <StepHeading n={2} label={t('eduroam.s2')} />

      {/* Step 1 (android/windows): install the geteduroam helper app */}
      {manual.doOnceUrl && (
        <NumberedRow n={1} last={false}>
          <div className="text-base leading-relaxed">{t(manualKey(target, 'doOnce', 'title'))}</div>
          <a
            href={manual.doOnceUrl} target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary btn-block btn-sm gap-2"
          >
            {t(manualKey(target, 'doOnce', 'cta'))} <ExternalLink className="w-4 h-4" />
          </a>
        </NumberedRow>
      )}

      {/* Numbered steps (offset by the install step where present). The final
          "connect on campus" row below is always the last, so steps never are. */}
      {manual.steps.map((step, i) => {
        const warn = t(manualKey(target, 'steps', i, 'warn'));
        const hasWarn = warn !== manualKey(target, 'steps', i, 'warn');
        const showQr = step.action === 'qr' && status === 'done' && qrDataUrl;
        return (
          <NumberedRow key={i} n={i + 1 + (manual.doOnceUrl ? 1 : 0)} last={false}>
            <div className="text-base leading-relaxed">{t(manualKey(target, 'steps', i, 'text'))}</div>

            {hasWarn && (
              <div className="flex items-start gap-2 p-2.5 rounded-field bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span className="text-sm leading-snug text-warning">{warn}</span>
              </div>
            )}

            {step.password && password && (
              <PasswordChip password={password} label={t('eduroam.pwdLabel')} />
            )}

            {step.action && !showQr && (
              <ActionButton action={step.action} status={status} onRun={onRun} onOpenSettings={onOpenSettings} />
            )}

            {showQr && (
              <div className="self-start bg-white p-3 rounded-box">
                <img src={qrDataUrl!} alt="eduroam QR" width={200} height={200} />
              </div>
            )}

            {step.img && (
              <button
                type="button"
                onClick={() => setZoom(step.img!)}
                aria-label={t('eduroam.viewImage')}
                className={`block w-full cursor-zoom-in ${phone ? 'max-w-[300px]' : ''}`}
              >
                <img
                  src={step.img}
                  alt=""
                  loading="lazy"
                  className="w-full rounded-box border border-base-content/10"
                />
              </button>
            )}
          </NumberedRow>
        );
      })}

      {/* Final step: the real finish line — connect once you're on campus */}
      <NumberedRow last done>
        <div className="text-base leading-relaxed font-medium">{t('eduroam.connectStep')}</div>
      </NumberedRow>

      {/* Tap-to-zoom lightbox */}
      {zoom && (
        <button
          type="button"
          onClick={() => setZoom(null)}
          aria-label={t('eduroam.closeImage')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 cursor-zoom-out"
        >
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-box shadow-2xl" />
        </button>
      )}
    </div>
  );
}
