import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { useDocumentNote } from '../../hooks/data/useDocumentNote';
import { useTranslation } from '../../hooks/useTranslation';
import { parseNote, serializeNote, type DocumentNoteData, type NoteCardData } from './utils/noteParser';
import { NoteCard } from './NoteCard';

interface DocumentNoteEditorProps {
    courseCode: string;
    fileLink: string;
    fileName: string;
    onClose: () => void;
    showHeader?: boolean;
}

function newCardId(): string {
    return `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function DocumentNoteEditor({ courseCode, fileLink, fileName, onClose, showHeader = false }: DocumentNoteEditorProps) {
    const { t } = useTranslation();
    const { note, setNote, isLoading, isSaving, hasError } = useDocumentNote(courseCode, fileLink);
    const [data, setData] = useState<DocumentNoteData>({ cards: [], notes: '' });
    const focusCardRef = useRef<string | null>(null);

    // Hydrate from storage on initial load or when the file/course changes.
    useEffect(() => {
        if (!isLoading) setData(parseNote(note));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, fileLink, courseCode]);

    const save = useCallback((next: DocumentNoteData) => {
        setData(next);
        setNote(serializeNote(next), fileName);
    }, [setNote, fileName]);

    const updateCard = useCallback((id: string, patch: Partial<NoteCardData>) => {
        setData((prev) => {
            const next = { ...prev, cards: prev.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
            setNote(serializeNote(next), fileName);
            return next;
        });
    }, [setNote, fileName]);

    const addCard = useCallback((afterId?: string) => {
        const card: NoteCardData = { id: newCardId(), question: '', answer: '', collapsed: false };
        focusCardRef.current = card.id;
        setData((prev) => {
            const cards = [...prev.cards];
            const idx = afterId ? cards.findIndex((c) => c.id === afterId) : -1;
            if (idx >= 0) cards.splice(idx + 1, 0, card);
            else cards.push(card);
            const next = { ...prev, cards };
            setNote(serializeNote(next), fileName);
            return next;
        });
    }, [setNote, fileName]);

    const deleteCard = useCallback((id: string) => {
        setData((prev) => {
            const idx = prev.cards.findIndex((c) => c.id === id);
            focusCardRef.current = idx > 0 ? prev.cards[idx - 1].id : null;
            const next = { ...prev, cards: prev.cards.filter((c) => c.id !== id) };
            setNote(serializeNote(next), fileName);
            return next;
        });
    }, [setNote, fileName]);

    const setNotes = useCallback((notes: string) => {
        save({ ...data, notes });
    }, [data, save]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-base-100 ${showHeader ? 'h-full' : 'py-8 rounded-lg border border-base-300'}`}>
                <span className="loading loading-spinner loading-md text-primary" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col bg-base-100 ${showHeader ? 'h-full border-l border-base-300' : 'max-h-[60vh] rounded-lg border border-base-300'}`}>
            {showHeader && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200/50 shrink-0">
                    <h3 className="text-sm font-semibold text-base-content truncate mr-3" title={fileName}>{fileName}</h3>
                    <button onClick={onClose} className="btn btn-ghost btn-xs btn-square"><X size={14} /></button>
                </div>
            )}

            <div className={`overflow-y-auto p-4 space-y-2 ${showHeader ? 'flex-1' : ''}`}>
                {data.cards.map((card) => (
                    <NoteCard
                        key={card.id}
                        card={card}
                        autoFocus={focusCardRef.current === card.id}
                        onChange={(patch) => updateCard(card.id, patch)}
                        onEnterAnswer={() => addCard(card.id)}
                        onDelete={() => deleteCard(card.id)}
                    />
                ))}

                <button
                    onClick={() => addCard()}
                    className="btn btn-ghost btn-sm gap-1.5 text-primary/80 hover:text-primary w-full justify-start"
                >
                    <Plus size={14} />
                    {t('course.documentNote.addCard')}
                </button>

                <div className="pt-1">
                    <textarea
                        value={data.notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('course.documentNote.notesPlaceholder')}
                        className="textarea textarea-bordered w-full text-sm leading-relaxed min-h-20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>

                <div className="h-4 text-[10px] font-medium">
                    {hasError ? <span className="text-error">{t('course.documentNote.saveError')}</span>
                        : isSaving ? <span className="text-primary/70">{t('course.documentNote.saving')}</span>
                            : note ? <span className="text-success">{t('course.documentNote.saved')}</span> : null}
                </div>
            </div>
        </div>
    );
}
