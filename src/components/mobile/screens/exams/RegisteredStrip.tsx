import type { ReactNode } from 'react';
import type { RegisteredExam } from '../../../../utils/mobile/examRows';
import { formatWhenRow } from '../../../../utils/mobile/examWhen';

export interface RegisteredStripProps {
  rows: RegisteredExam[];
  now: Date;
  locale: string;
  /** The section whose detail is open, if it is one of these. */
  selectedId: string | null;
  onSelect: (row: RegisteredExam) => void;
  /** The full card for the selected exam — a RegisteredCard, opened. */
  renderDetail: (row: RegisteredExam) => ReactNode;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * The student's registered exams as small tiles they swipe through sideways,
 * and under them the full card of the one they tapped.
 *
 * The ONE place a registered exam appears. It used to be a tile here AND a full
 * card further down the list, so every exam was on screen twice. The list copy
 * is gone; its detail — Odhlásit, the other terms — now opens only on demand,
 * under the strip, because a student who is already registered mostly wants
 * the date and the room, which the tile carries.
 *
 * Today's tile is outlined in the error colour: the one case where the screen
 * should interrupt, and the only red on it.
 */
export function RegisteredStrip({
  rows,
  now,
  locale,
  selectedId,
  onSelect,
  renderDetail,
}: RegisteredStripProps) {
  const selected = rows.find((r) => r.section.id === selectedId);
  return (
    <div className="flex flex-col gap-2.5">
      {/* Edge to edge, so the next tile peeking in at the right says "swipe". */}
      <div
        data-testid="registered-strip"
        className="-mx-4 flex items-stretch gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rows.map((row) => {
          const today = sameDay(row.date, now);
          const isSelected = row.section.id === selectedId;
          const look = isSelected
            ? 'border-success bg-success/10'
            : today
              ? 'border-error/50 bg-error/5'
              : 'border-base-300 bg-base-100';
          return (
            <button
              key={row.section.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(row)}
              className={`flex w-[178px] flex-shrink-0 flex-col gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left ${look}`}
            >
              <span
                className={`truncate text-xs font-bold ${today ? 'text-error' : 'text-success'}`}
              >
                {formatWhenRow(row.date, row.term.time, locale)}
              </span>
              {/* Two lines each, not one with an ellipsis: "Průběžný test 1 ·
                  Studovna PEF (ČP)" needs 203px and the tile gives 148, so the
                  room — the half a student is looking for — was the half that
                  got cut. Measured on the device's own data at 375px. */}
              <span className="line-clamp-2 break-words text-md font-bold text-base-content">
                {row.subjectName}
              </span>
              <span className="line-clamp-2 break-words text-2sm text-base-content/60">
                {[row.sectionName, row.term.room].filter(Boolean).join(' · ')}
              </span>
            </button>
          );
        })}
      </div>
      {selected && <div data-testid="registered-detail">{renderDetail(selected)}</div>}
    </div>
  );
}
