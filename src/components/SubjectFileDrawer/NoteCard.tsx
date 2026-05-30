import { useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { NoteCardData } from './utils/noteParser';

interface NoteCardProps {
    card: NoteCardData;
    autoFocus: boolean;
    onChange: (patch: Partial<NoteCardData>) => void;
    onEnterAnswer: () => void; // Enter in the answer -> create the next card
    onDelete: () => void;
}

export function NoteCard({ card, autoFocus, onChange, onEnterAnswer, onDelete }: NoteCardProps) {
    const { t } = useTranslation();
    const questionRef = useRef<HTMLInputElement>(null);
    const answerRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (autoFocus) questionRef.current?.focus();
    }, [autoFocus]);

    const grow = useCallback((el: HTMLTextAreaElement | null) => {
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, []);

    const setAnswerRef = useCallback((el: HTMLTextAreaElement | null) => {
        answerRef.current = el;
        grow(el);
    }, [grow]);

    const handleQuestionKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (card.collapsed) onChange({ collapsed: false });
            setTimeout(() => answerRef.current?.focus(), 0);
        } else if (e.key === 'Backspace' && !card.question && !card.answer) {
            e.preventDefault();
            onDelete();
        }
    };

    const handleAnswerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEnterAnswer();
        } else if (e.key === 'Backspace' && !card.answer && !card.question) {
            e.preventDefault();
            onDelete();
        }
    };

    return (
        <div className="group rounded-lg border border-base-300 bg-base-200/30 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => onChange({ collapsed: !card.collapsed })}
                    className="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-base-300 text-base-content/50 focus:outline-none"
                    title={t('course.documentNote.toggleTitle')}
                >
                    <ChevronRight size={14} className={`transition-transform duration-200 ${!card.collapsed ? 'rotate-90 text-primary' : ''}`} />
                </button>
                <input
                    ref={questionRef}
                    type="text"
                    value={card.question}
                    onChange={(e) => onChange({ question: e.target.value })}
                    onKeyDown={handleQuestionKey}
                    placeholder={t('course.documentNote.questionPlaceholder')}
                    className="flex-1 bg-transparent focus:outline-none text-sm font-semibold text-base-content placeholder:text-base-content/30 border-0 p-0"
                />
                <button
                    onClick={onDelete}
                    className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-base-content/40 hover:text-error"
                    title={t('course.documentNote.deleteCard')}
                >
                    <Trash2 size={13} />
                </button>
            </div>
            {!card.collapsed && (
                <div className="pl-6 border-l border-base-300 ml-2.5 mt-1 py-0.5">
                    <textarea
                        ref={setAnswerRef}
                        value={card.answer}
                        onChange={(e) => { grow(e.target); onChange({ answer: e.target.value }); }}
                        onKeyDown={handleAnswerKey}
                        placeholder={t('course.documentNote.answerPlaceholder')}
                        rows={1}
                        className="w-full bg-transparent resize-none focus:outline-none text-sm text-base-content/80 leading-relaxed border-0 p-0"
                    />
                </div>
            )}
        </div>
    );
}
