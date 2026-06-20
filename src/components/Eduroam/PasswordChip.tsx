import { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/** Certificate-password chip with copy-to-clipboard. The student types this at install. */
export function PasswordChip({ password, label }: { password: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the student can still read the password */
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
          {label}
        </span>
      )}
      <button
        onClick={copy}
        className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors"
      >
        <KeyRound className="w-[18px] h-[18px] text-primary shrink-0" />
        <span className="flex-1 text-left font-mono text-[15px] tracking-wide">{password}</span>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary shrink-0">
          {copied ? <Check className="w-[15px] h-[15px]" /> : <Copy className="w-[15px] h-[15px]" />}
          {copied ? t('eduroam.copied') : t('eduroam.copy')}
        </span>
      </button>
    </div>
  );
}
