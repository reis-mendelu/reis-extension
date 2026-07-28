import type { RegisteredExam } from '../../../../utils/mobile/examRows';
import { formatWhenShort, isSameDay } from '../../../../utils/mobile/examWhen';

export interface NextUpStripProps {
    items: RegisteredExam[];
    now: Date;
    locale: string;
    t: (key: string, params?: Record<string, string | number>) => string;
    onOpen: (item: RegisteredExam) => void;
}

/**
 * The horizontal "what's coming" strip above the exam list.
 *
 * This is the answer to showing every registered exam on a phone: a rail that
 * positions dots along a fixed width has to cluster once there are more than a
 * handful, but a scrolling strip of cards has no such limit — each exam keeps
 * its own card and you swipe to the rest. Chronological, nearest first.
 *
 * Today's card is outlined in the error colour. That is the one case where a
 * student needs the screen to interrupt them, and it is the only red on the
 * screen, so it cannot be mistaken for anything else.
 */
export function NextUpStrip({ items, now, locale, t, onOpen }: NextUpStripProps) {
    if (items.length === 0) return null;

    return (
        <div className="flex-shrink-0">
            <div className="px-5 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-base-content/60">
                {t('mobile.exams.nextUp')}
            </div>
            <div
                data-testid="next-up-strip"
                className="flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {items.map((item) => {
                    const today = isSameDay(item.date, now);
                    return (
                        <button
                            key={item.section.id}
                            type="button"
                            onClick={() => onOpen(item)}
                            className={`flex w-[178px] flex-shrink-0 flex-col gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left ${
                                today ? 'border-error/50 bg-error/5' : 'border-base-300 bg-base-100'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <span
                                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${today ? 'bg-error' : 'bg-primary'}`}
                                />
                                <span
                                    className={`truncate text-xs font-bold ${today ? 'text-error' : 'text-base-content'}`}
                                >
                                    {formatWhenShort(item.date, item.term.time, now, locale, t('mobile.exams.today'))}
                                </span>
                            </span>
                            <span className="truncate text-md font-bold text-base-content">{item.subjectName}</span>
                            <span className="truncate text-2sm text-base-content/60">
                                {[item.sectionName, item.term.room].filter(Boolean).join(' · ')}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
