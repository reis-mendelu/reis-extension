/**
 * SubjectNote Component
 * 
 * Minimal, unobtrusive note input for subjects.
 * Collapsed by default, expands on click, auto-saves on blur.
 */

import { useState, useRef, useEffect } from 'react';
import { StickyNote } from 'lucide-react';
import { useSubjectNote } from '../../hooks/data/useSubjectNote';

interface SubjectNoteProps {
    subjectCode: string | undefined;
}

const MAX_LENGTH = 500;
const SHOW_COUNTER_THRESHOLD = 400;

export function SubjectNote({ subjectCode }: SubjectNoteProps) {
    const { note, setNote, isLoading } = useSubjectNote(subjectCode);
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to end
            textareaRef.current.selectionStart = textareaRef.current.value.length;
        }
    }, [isEditing]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [note, isEditing]);

    const handleBlur = () => {
        // Collapse if empty
        if (!note.trim()) {
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Escape to close
        if (e.key === 'Escape') {
            setIsEditing(false);
            e.stopPropagation();
        }
    };

    // Don't render if no subject
    if (!subjectCode) return null;

    // Loading state
    if (isLoading) {
        return (
            <div className="mt-3 text-sm text-base-content/40 italic">
                Načítání poznámky...
            </div>
        );
    }

    // Collapsed state (no note or not editing)
    if (!isEditing && !note) {
        return (
            <button
                onClick={() => setIsEditing(true)}
                className="mt-3 flex items-center gap-1.5 text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
            >
                <StickyNote size={14} />
                <span className="italic">Přidat poznámku...</span>
            </button>
        );
    }

    // Expanded state (has note or is editing)
    return (
        <div className="mt-3">
            {isEditing ? (
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Tvá poznámka k předmětu..."
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
