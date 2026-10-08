import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EVENT_EMOJI, EMOJI_GROUPS, findEventEmoji } from '../../data/eventEmoji';

/**
 * The composer's picture for an event: the chosen emoji and its name, opening
 * a grouped grid of the shipped catalog. Picking one closes the grid. Its
 * category follows from the catalog (buildPostInput), so there is no second
 * control for the fallback older builds read.
 */
export function ComposerEmojiField({
  value,
  onChange,
  t,
  language,
}: {
  value: string;
  onChange: (code: string) => void;
  t: (k: string) => string;
  language: 'cz' | 'en';
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = findEventEmoji(value);
  const name = (code: string) => {
    const e = findEventEmoji(code);
    return e ? e[language] : code;
  };
  return (
    <div>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-label={`${current ? name(value) : value} · ${t('map.emojiChange')}`}
        className="btn btn-ghost btn-sm gap-2 border border-base-content/15"
        onClick={() => setOpen((o) => !o)}
      >
        <img src={`/emoji/${current?.code ?? '2728'}.svg`} alt="" className="h-5 w-5" />
        <span>{current ? name(value) : value}</span>
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-base-content/10 p-2">
          {EMOJI_GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1 text-xs font-semibold text-base-content/70">
                {t(`map.emojiGroup.${g}`)}
              </div>
              <div className="flex flex-wrap gap-1">
                {EVENT_EMOJI.filter((e) => e.group === g).map((e) => (
                  <button
                    key={e.code}
                    type="button"
                    aria-label={e[language]}
                    aria-pressed={e.code === value}
                    title={e[language]}
                    className={`btn btn-square btn-sm ${e.code === value ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      onChange(e.code);
                      setOpen(false);
                      // The option under focus is about to unmount.
                      trigger.current?.focus();
                    }}
                  >
                    <img src={`/emoji/${e.code}.svg`} alt="" className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
