import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * The teacher's "Pokyny" for one box. IS hides them behind an icon's popup,
 * which is how students miss them, so the folded line already shows how they
 * start. Plain text from the parser (boxInstructions.ts); never HTML.
 */
export function BoxInstructions({ text }: { text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const preview = text.split('\n')[0];

  return (
    <details
      data-testid="box-instructions"
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="border-t border-base-content/10 px-3 py-1.5"
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={14}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="shrink-0 font-semibold">{t('odevzdavarny.instructions')}</span>
        {!open && <span className="min-w-0 truncate text-base-content/70">· {preview}</span>}
      </summary>
      {/* Mounted only while open: a closed <details> still lays its content out. */}
      {open && (
        <p
          data-testid="box-instructions-text"
          className="whitespace-pre-line break-words pb-1.5 text-xs text-base-content/80"
        >
          {text}
        </p>
      )}
    </details>
  );
}
