import { useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import type { NoteCardData } from './utils/noteParser';
import { normalizeImage } from '../../services/notes/imageNormalize';
import { storeImage } from '../../services/notes/noteImageStore';
import { useNoteImage } from './useNoteImage';

/** A field patch, or an updater computed from the *current* card (avoids
 *  clobbering concurrent edits when the patch is built after an async gap). */
export type CardPatch = Partial<NoteCardData> | ((card: NoteCardData) => Partial<NoteCardData>);

interface NoteCardProps {
    card: NoteCardData;
    autoFocus: boolean;
    onChange: (patch: CardPatch) => void;
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

    const addImages = useCallback(async (files: File[]) => {
        const images = files.filter((f) => f.type.startsWith('image/'));
        const hashes: string[] = [];
        for (const file of images) {
            try {
                const norm = await normalizeImage(file);
                hashes.push(await storeImage(norm));
            } catch (err) {
                if (err instanceof DOMException && err.name === 'QuotaExceededError') {
                    toast.error(t('course.documentNote.imageQuotaFull'));
                    break;
                }
                /* skip a single undecodable image rather than break the note */
            }
        }
        // Derive from the live card inside the updater — image encoding above is
        // async, so `card.images` captured here may be stale by now.
        if (hashes.length) onChange((c) => ({ images: [...c.images, ...hashes] }));
    }, [onChange, t]);

    const removeImage = (hash: string) => onChange((c) => ({ images: c.images.filter((h) => h !== hash) }));

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
                        onPaste={(e) => {
                            const files = [...e.clipboardData.items]
                                .filter((i) => i.kind === 'file')
                                .map((i) => i.getAsFile())
                                .filter((f): f is File => !!f);
                            if (files.length) { e.preventDefault(); void addImages(files); }
                        }}
                        onDrop={(e) => {
                            if (e.dataTransfer.files.length) { e.preventDefault(); void addImages([...e.dataTransfer.files]); }
                        }}
                        placeholder={t('course.documentNote.answerPlaceholder')}
                        rows={1}
                        className="w-full bg-transparent resize-none focus:outline-none text-sm text-base-content/80 leading-relaxed border-0 p-0"
                    />
                    {card.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {card.images.map((h) => (
                                <Thumb key={h} hash={h} onRemove={() => removeImage(h)} removeLabel={t('course.documentNote.removeImage')} />
                            ))}
                        </div>
                    )}
                    <label className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-primary mt-1 cursor-pointer">
                        <ImagePlus size={13} />
                        {t('course.documentNote.addImage')}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => { if (e.target.files) { void addImages([...e.target.files]); e.target.value = ''; } }}
                        />
                    </label>
                </div>
            )}
        </div>
    );
}

function Thumb({ hash, onRemove, removeLabel }: { hash: string; onRemove: () => void; removeLabel: string }) {
    const url = useNoteImage(hash);
    if (!url) return null;
    return (
        <div className="relative group/thumb">
            <img src={url} alt="" className="max-h-32 rounded border border-base-300" />
            <button
                onClick={onRemove}
                title={removeLabel}
                className="btn btn-xs btn-circle btn-error absolute -top-2 -right-2 opacity-0 group-hover/thumb:opacity-100"
            >
                <Trash2 size={11} />
            </button>
        </div>
    );
}
