/**
 * DocumentNote Component
 *
 * Inline collapsible note editor for a single document file.
 * Renders below the file row when expanded.
 */

import { useState, useRef, useEffect } from 'react';
import { StickyNote } from 'lucide-react';
import { useDocumentNote } from '../../hooks/data/useDocumentNote';
import { useTranslation } from '../../hooks/useTranslation';

interface DocumentNoteProps {
    courseCode: string;
    fileLink: string;
    onNoteChange?: (fileLink: string, hasNote: boolean) => void;
}

const MAX_LENGTH = 500;
const SHOW_COUNTER_THRESHOLD = 400;

export function DocumentNote({ courseCode, fileLink, onNoteChange }: DocumentNoteProps) {
    const { note, setNote, isLoading } = useDocumentNote(courseCode, fileLink);
    const [isEditing, setIsEditing] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevHasNoteRef = useRef<boolean>(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (isEditing && !isLoading && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.selectionStart = textareaRef.current.value.length;
        }
    }, [isEditing, isLoading]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [note, isEditing]);

    // Notify parent when note presence changes
    useEffect(() => {
        if (isLoading) return;
        const hasNote = note.trim().length > 0;
        if (hasNote !== prevHasNoteRef.current) {
            prevHasNoteRef.current = hasNote;
            onNoteChange?.(fileLink, hasNote);
        }
    }, [note, isLoading, fileLink, onNoteChange]);

    const handleBlur = () => {
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
            e.stopPropagation();
        }
    };

    if (isLoading) return null;

    if (!isEditing && !note) {
        return (
            <div className="px-3 pb-3">
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
                >
                    <StickyNote size={14} />
                    <span className="italic">{t('course.documentNote.add')}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="px-3 pb-3">
            {isEditing ? (
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={t('course.documentNote.placeholder')}
                        maxLength={MAX_LENGTH}
                        rows={1}
                        className="w-full bg-base-200/50 border border-base-300 rounded-lg px-3 py-2 text-sm text-base-content placeholder:text-base-content/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                    />
                    {note.length > SHOW_COUNTER_THRESHOLD && (
                        <span className="absolute bottom-2 right-2 text-xs text-base-content/40">
                            {note.length}/{MAX_LENGTH}
                        </span>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => setIsEditing(true)}
                    className="w-full text-left bg-base-200/30 border border-base-300/50 rounded-lg px-3 py-2 text-sm text-base-content/70 hover:bg-base-200/50 hover:border-base-300 transition-colors"
                >
                    <div className="flex items-start gap-2">
                        <StickyNote size={14} className="mt-0.5 text-base-content/40 flex-shrink-0" />
                        <span className="whitespace-pre-wrap break-words">{note}</span>
                    </div>
                </button>
            )}
        </div>
    );
}
