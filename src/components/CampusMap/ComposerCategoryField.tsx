import type { EventCategory } from '../../types/events';
import { EVENT_CATEGORIES, CATEGORY_ICON } from '../../data/eventCategories';

/** The composer's category chips — one pressed, the pin's emoji follows it. */
export function ComposerCategoryField({
  value,
  onChange,
  t,
}: {
  value: EventCategory;
  onChange: (c: EventCategory) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_CATEGORIES.map((key) => {
        const Icon = CATEGORY_ICON[key];
        const label = t(`map.category.${key}`);
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={value === key}
            className={`btn btn-xs gap-1 ${value === key ? 'btn-primary' : 'btn-ghost border border-base-content/15'}`}
            onClick={() => onChange(key)}
          >
            <Icon size={13} /> {label}
          </button>
        );
      })}
    </div>
  );
}
