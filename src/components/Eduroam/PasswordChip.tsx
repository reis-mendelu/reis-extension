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
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
          {label}
        </span>
      )}
      <button
        onClick={copy}
        className="flex items-center gap-3 w-full px-3.5 py-3 rounded-field bg-base-200 border border-base-content/10 hover:bg-base-300 transition-colors"
      >
        <KeyRound className="w-4 h-4 text-base-content/40 shrink-0" />
        <span className="flex-1 text-left font-mono text-base tracking-wide">{password}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-base-content/50 shrink-0">
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? t('eduroam.copied') : t('eduroam.copy')}
        </span>
      </button>
    </div>
  );
}
