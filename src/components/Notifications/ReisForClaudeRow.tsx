import { MessageSquareText, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useReisForClaude } from '../../hooks/useReisForClaude';
import { trackFeatureSignal } from '../../api/featureUsage';
import { REIS_FOR_CLAUDE_GUIDE_URL } from '../../utils/reisForClaude';

/**
 * "reIS v Claude" at the top of the extension's Novinky: one row pointing IT
 * students to the guide for the Claude Desktop extension (reIS for Claude,
 * `mcp/`). Opening it counts the install (`reis_for_claude_guide_opened`) and
 * hides the row for good; the cross hides it without counting.
 *
 * Code-side rather than a Novinky post, because a post cannot be limited to the
 * extension, and the phone has no Claude Desktop (phoneHasNoReisForClaude.test.ts).
 * The text wraps instead of truncating: it says what the tool does, which is
 * the point of the row. Same card and type sizes as NotificationItem.
 */
export function ReisForClaudeRow() {
  const { t } = useTranslation();
  const { visible } = useReisForClaude();
  const finish = useAppStore((s) => s.finishReisForClaude);
  if (!visible) return null;
  const open = () => {
    void trackFeatureSignal('reis_for_claude_guide_opened');
    finish();
  };
  return (
    <div
      data-testid="reis-for-claude-row"
      className="flex w-full items-start gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5 transition-colors hover:bg-base-200"
    >
      <a
        href={REIS_FOR_CLAUDE_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={open}
        onAuxClick={(e) => {
          if (e.button === 1) open();
        }}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageSquareText size={16} />
        </span>
        <span className="min-w-0 flex-1 text-2sm leading-snug text-base-content">
          {t('reisForClaude.text')}
        </span>
      </a>
      <button
        type="button"
        onClick={finish}
        aria-label={t('reisForClaude.dismiss')}
        title={t('reisForClaude.dismiss')}
        className="-mr-1 flex-shrink-0 rounded p-1 text-base-content/60 hover:bg-base-300"
      >
        <X size={14} />
      </button>
    </div>
  );
}
