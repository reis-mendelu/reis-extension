import { Loader2, QrCode, Download, ExternalLink, ImageIcon, Check, AlertTriangle, Wifi } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
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

/** Dashed 16:9 screenshot placeholder with a caption. */
function Shot({ caption }: { caption: string }) {
  return (
    <div className="relative w-full aspect-video rounded-xl border border-dashed border-base-content/15 bg-base-300/50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-1.5 text-base-content/40 text-center">
        <ImageIcon className="w-5 h-5" />
        <span className="text-xs font-medium leading-snug">{caption}</span>
      </div>
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
    <button className="btn btn-primary gap-2" disabled={working} onClick={onRun}>
      {working ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      {working ? t('eduroam.preparing') : action === 'qr' ? t('eduroam.createQr') : t('eduroam.download')}
    </button>
  );
}

export function EduroamTutorial({ target, status, qrDataUrl, password, onRun, onOpenSettings }: EduroamTutorialProps) {
  const { t } = useTranslation();
  const manual = EDUROAM_MANUAL[target];

  return (
    <div className="mt-6">
      {/* Step 2 heading */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-[13px]">2</span>
        <span className="font-semibold text-[15px] text-base-content/80">{t('eduroam.s2')}</span>
      </div>

      {/* Do once */}
      {manual.doOnceUrl && (
        <div className="mb-5 p-4 rounded-2xl border border-dashed border-base-content/15 bg-base-content/[0.025]">
          <div className="inline-flex items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-[11px] font-bold uppercase tracking-wider">
            {t('eduroam.doOnce')}
          </div>
          <div className="text-[15px] mb-3">{t(manualKey(target, 'doOnce', 'title'))}</div>
          <a
            href={manual.doOnceUrl} target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary btn-block gap-2"
          >
            {t(manualKey(target, 'doOnce', 'cta'))} <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Numbered steps */}
      {manual.steps.map((step, i) => {
        const last = i === manual.steps.length - 1;
        const warn = t(manualKey(target, 'steps', i, 'warn'));
        const hasWarn = warn !== manualKey(target, 'steps', i, 'warn');
        const showQr = step.action === 'qr' && status === 'done' && qrDataUrl;
        return (
          <div key={i} className="flex gap-3.5 mb-4">
            <div className="flex flex-col items-center shrink-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-base-100 border border-base-content/10 font-bold text-sm">{i + 1}</span>
              {!last && <div className="w-px flex-1 bg-gradient-to-b from-base-content/15 to-transparent mt-1 min-h-2" />}
            </div>
            <div className="flex-1 pb-1 flex flex-col gap-2.5">
              <div className="text-[15px] leading-relaxed">{t(manualKey(target, 'steps', i, 'text'))}</div>

              {hasWarn && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <span className="text-[13px] leading-snug text-warning">{warn}</span>
                </div>
              )}

              {step.password && password && (
                <PasswordChip password={password} label={t('eduroam.pwdLabel')} />
              )}

              {step.action && !showQr && (
                <ActionButton action={step.action} status={status} onRun={onRun} onOpenSettings={onOpenSettings} />
              )}

              {showQr ? (
                <div className="self-start bg-white p-3 rounded-xl">
                  <img src={qrDataUrl!} alt="eduroam QR" width={200} height={200} />
                </div>
              ) : (
                !step.action && <Shot caption={t(manualKey(target, 'steps', i, 'shot'))} />
              )}
            </div>
          </div>
        );
      })}

      {/* Done banner */}
      <div className="mt-1.5 p-4 rounded-xl bg-primary/10 border border-primary/30">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-content shrink-0"><Check className="w-4 h-4" /></span>
          <span className="font-bold text-[15px]">{t(manualKey(target, 'done', 'text'))}</span>
        </div>
        <div className="relative w-full aspect-video rounded-lg border border-dashed border-primary/30 bg-base-300/50 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-1.5 text-base-content/40 text-center">
            <Wifi className="w-5 h-5" />
            <span className="text-xs font-medium leading-snug">{t(manualKey(target, 'done', 'shot'))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
