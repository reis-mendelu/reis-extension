import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  /** A Chyba sends through two buttons; a Nápad or Jiné through one. */
  isBug: boolean;
  /** The checkbox, which a Nápad or Jiné still shows. Ignored for a Chyba. */
  includeDiagnostics: boolean;
  isSending: boolean;
  disabled: boolean;
  onSend: (withDiagnostics: boolean) => void;
}

/**
 * A Chyba asks the student to choose: send with the technical details, or
 * without. It used to be an unticked box that bug reports arrived without
 * (Dominik, Oct 2026: reported bugs could not be traced; the one open bug
 * report then had no log, and done reports' attachments are already deleted).
 * A pre-ticked box would not be consent (CJEU Planet49, C-673/17), and the
 * EDPB counts an app sending its own on-device log as access under ePrivacy
 * Art. 5(3) (Guidelines 2/2023). Two buttons make it an active choice at the
 * same one click, with the log as the primary option.
 */
export function ReportSendButtons({
  isBug,
  includeDiagnostics,
  isSending,
  disabled,
  onSend,
}: Props) {
  const { t } = useTranslation();
  // Which of a Chyba's two buttons was pressed, so only that one spins. A
  // single button spins on any send: Enter sends a Nápad or Jiné without
  // pressing it.
  const [pressed, setPressed] = useState<boolean | null>(null);

  const send = (withDiagnostics: boolean) => {
    setPressed(withDiagnostics);
    onSend(withDiagnostics);
  };

  const label = (text: string, mine: boolean) =>
    isSending && (!isBug || pressed === mine) ? (
      <>
        <Loader2 className="w-5 h-5 animate-spin" />
        {t('feedback.sending')}
      </>
    ) : (
      <>
        <Send className="w-5 h-5" />
        {text}
      </>
    );

  if (!isBug) {
    return (
      <div className="pt-2">
        <button
          type="button"
          onClick={() => send(includeDiagnostics)}
          disabled={disabled}
          className="btn btn-primary w-full gap-2 font-semibold no-animation"
        >
          {label(t('feedback.submit'), includeDiagnostics)}
        </button>
      </div>
    );
  }

  return (
    <div className="pt-2 space-y-2">
      <button
        type="button"
        onClick={() => send(true)}
        disabled={disabled}
        className="btn btn-primary w-full gap-2 font-semibold no-animation"
      >
        {label(t('feedback.submitWithDiagnostics'), true)}
      </button>
      <button
        type="button"
        onClick={() => send(false)}
        disabled={disabled}
        className="btn btn-ghost w-full gap-2 font-medium no-animation text-base-content/75 hover:text-base-content"
      >
        {label(t('feedback.submitWithoutDiagnostics'), false)}
      </button>
      <p className="text-xs text-center text-base-content/70">{t('feedback.diagnosticsHint')}</p>
    </div>
  );
}
