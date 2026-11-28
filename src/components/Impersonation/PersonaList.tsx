import { useState, type ReactNode } from 'react';
import { AlertCircle, Check, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { PERSONAS, type PersonaId } from '../../features/personas';
import { IMPERSONATION_ERROR_KEY } from './errorKeys';
import { logError } from '../../utils/reportError';

interface Props {
  /** `compact`: the desktop avatar popup. `touch`: the phone/iPad Profil. */
  variant: 'compact' | 'touch';
  /** "Jiný obor…": the tree opens today's picker its own way (drawer / sheet). */
  onOther: () => void;
  /**
   * After a pick has taken effect — a persona applied, or back to Já — so the
   * surface around the list closes (decision #16). Not after a failed switch:
   * the row stays to say why.
   */
  onDone?: () => void;
  /** The sheet's header already says "Zobrazit jako". */
  hideTitle?: boolean;
}

const ROW = {
  compact: 'px-1 py-1.5 rounded-lg hover:bg-base-200 text-xs',
  touch: 'px-4 py-2.5 text-md',
};

function Row({
  variant,
  checked,
  disabled,
  onClick,
  children,
  trail,
}: Props & {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  trail?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 text-left transition-colors disabled:opacity-60 ${ROW[variant]}`}
    >
      <span className="flex w-4 flex-shrink-0 justify-center">
        {checked && <Check size={14} className="text-primary" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
      {trail}
    </button>
  );
}

/**
 * "Zobrazit jako" for reIS admins (design 2026-11-27 §6): Já, the seven
 * programme personas, then "Jiný obor…" for today's picker. One component on
 * both trees, so they cannot drift. Every fetch starts from a tap here, never
 * from an effect.
 */
export function PersonaList(props: Props) {
  const { variant, onOther, onDone, hideTitle } = props;
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const active = useAppStore((s) => s.impersonation);
  const rows = useAppStore((s) => s.personaRows);
  const switchTo = useAppStore((s) => s.switchToPersona);
  const stop = useAppStore((s) => s.stopImpersonation);
  const cancel = useAppStore((s) => s.cancelPersonaSwitch);
  const [leaving, setLeaving] = useState(false);
  const activeId = active?.selection.personaId;
  const busy = Object.values(rows).includes('loading');

  // Same double-tap guard as the banner: exit re-reads nine stores.
  const me = async () => {
    // Já always ends a fetch in flight (persona or picker), so its row is
    // freed at once; with nothing applied yet that is all it has to do.
    cancel();
    if (leaving) return;
    if (!active) return onDone?.();
    setLeaving(true);
    try {
      await stop();
      onDone?.();
    } catch (e) {
      logError('PersonaList.exit', e);
    } finally {
      setLeaving(false);
    }
  };
  const pick = async (id: PersonaId) => {
    if (await switchTo(id)) onDone?.();
  };

  return (
    <div role="radiogroup" aria-label={t('impersonation.personas.title')}>
      {!hideTitle && (
        <div
          className={`font-bold uppercase tracking-wider text-base-content/60 text-xs ${variant === 'compact' ? 'px-1 pb-1 pt-1.5' : 'px-4 pb-0.5 pt-2'}`}
        >
          {t('impersonation.personas.title')}
        </div>
      )}
      <Row {...props} checked={!active} onClick={() => void me()} disabled={leaving}>
        <span className="font-medium">{t('impersonation.personas.me')}</span>
      </Row>
      {PERSONAS.map((p) => {
        const state = rows[p.id];
        const error = state && state !== 'loading' ? state : null;
        return (
          <Row
            key={p.id}
            {...props}
            checked={activeId === p.id}
            disabled={busy}
            onClick={() => void pick(p.id)}
            trail={
              state === 'loading' ? (
                <span
                  data-testid="persona-spinner"
                  className="loading loading-spinner loading-xs flex-shrink-0"
                />
              ) : (
                <span className="badge badge-ghost badge-sm flex-shrink-0">{p.faculty}</span>
              )
            }
          >
            <span className="truncate font-medium">
              {p.label[language]} · {p.shortCode}
            </span>
            {error && (
              // The glyph carries the colour: text-error on base-100 is 3.9:1.
              <span className="flex items-center gap-1 text-xs text-base-content/70">
                <AlertCircle size={12} className="flex-shrink-0 text-error" aria-hidden />
                {t(IMPERSONATION_ERROR_KEY[error])}
              </span>
            )}
          </Row>
        );
      })}
      <Row
        {...props}
        checked={!!active && !activeId}
        onClick={onOther}
        trail={<ChevronRight size={14} className="flex-shrink-0 text-base-content/40" />}
      >
        <span className="font-medium">{t('impersonation.personas.other')}</span>
        {active && !activeId && (
          <span className="truncate text-xs text-base-content/60">
            {active.selection.shortCode} · {t('impersonation.yearN', { n: active.selection.year })}
          </span>
        )}
      </Row>
    </div>
  );
}
