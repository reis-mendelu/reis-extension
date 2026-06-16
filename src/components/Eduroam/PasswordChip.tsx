import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/** Certificate-password chip with copy-to-clipboard. The student types this at install. */
export function PasswordChip({ password }: { password: string }) {
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
    <button className="btn btn-sm btn-ghost font-mono gap-2 mt-2 ml-1" onClick={copy}>
      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      {password}
    </button>
  );
}
