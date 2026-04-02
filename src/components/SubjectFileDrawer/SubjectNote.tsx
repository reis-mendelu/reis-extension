/**
 * SubjectNote — minimalist per-subject note in the drawer header.
 * Empty: always an input, click to type. Has content: read-only text, click to edit.
 */

import { useState, useRef, useEffect } from 'react';
import { useDocumentNote } from '../../hooks/data/useDocumentNote';
import { useTranslation } from '../../hooks/useTranslation';

const SUBJECT_NOTE_KEY = '__subject__';

export function SubjectNote({ courseCode }: { courseCode: string }) {
    const { note, setNote, isLoading } = useDocumentNote(courseCode, SUBJECT_NOTE_KEY);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.selectionStart = inputRef.current.value.length;
        }
    }, [isEditing]);

    if (isLoading) return null;

    if (note && !isEditing) {
        return (
            <button
                onClick={() => setIsEditing(true)}
                className="w-full text-left py-1 text-xs text-base-content/50 hover:text-base-content/70 transition-colors truncate"
            >
                {note}
            </button>
        );
    }

    return (
        <input
            ref={inputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    setIsEditing(false);
                    inputRef.current?.blur();
                    e.stopPropagation();
                }
            }}
            placeholder={t('course.documentNote.placeholder')}
            maxLength={500}
            className="py-1 text-xs text-base-content/50 bg-transparent border-none outline-none placeholder:text-base-content/25 focus:text-base-content/70 w-full"
        />
    );
}
