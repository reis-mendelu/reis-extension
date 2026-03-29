import { useState, useRef, useEffect } from 'react';
import { Pencil, ExternalLink, X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { useCourseName } from '../../../hooks/ui/useCourseName';

interface EditableCourseTitleProps {
    courseCode?: string;
    courseId?: string;
    defaultName: string;
    language: string;
}

export function EditableCourseTitle({ courseCode, courseId, defaultName, language }: EditableCourseTitleProps) {
    const { t } = useTranslation();
    const setCourseNickname = useAppStore(state => state.setCourseNickname);
    const nickname = useAppStore(state => state.courseNicknames?.[courseCode || '']);
    const displayName = useCourseName(courseCode, defaultName);
    
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
        }
    }, [isEditing]);

    const startEditing = () => {
        setInputValue(nickname || '');
        setIsEditing(true);
    };

    const handleSave = () => {
        if (courseCode) {
            setCourseNickname(courseCode, inputValue);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setIsEditing(false);
            setInputValue(nickname || '');
        }
    };

    if (!courseCode) {
        return (
            <div className="flex items-center gap-2 group">
                <span className="text-lg sm:text-xl font-bold text-base-content">{displayName || defaultName}</span>
            </div>
        );
    }

    if (isEditing) {
        const handleBlur = (e: React.FocusEvent) => {
            // Don't close if focus moved to another element inside this container
            const container = e.currentTarget.closest('[data-edit-container]');
            if (container?.contains(e.relatedTarget as Node)) return;
            // If input is empty but a nickname existed, treat as cancel (don't silently delete)
            if (!inputValue.trim() && nickname) {
                setIsEditing(false);
                setInputValue(nickname);
                return;
            }
            handleSave();
        };

        const showClear = !!(inputValue || nickname);

        return (
            <div className="flex items-center gap-2 mt-1 mb-1 relative max-w-xs w-full" data-edit-container>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('course.nicknamePlaceholder')}
                    className={`input input-bordered input-sm w-full text-base font-bold focus:outline-none ${showClear ? 'pr-8' : ''}`}
                    onBlur={handleBlur}
                />
                {showClear && (
                    <button
                        tabIndex={0}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setInputValue('');
                            if (courseCode) setCourseNickname(courseCode, null);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full hover:bg-base-content/10 text-base-content/40 hover:text-error transition-colors"
                        title={t('course.removeNickname')}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2 group max-w-full">
            <div className="flex items-center gap-2 overflow-hidden">
                {courseId ? (
                    <a href={`https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${courseId};lang=${language}`} target="_blank" rel="noopener noreferrer" className="clickable-link text-lg sm:text-xl font-bold flex items-center gap-1.5 truncate">
                        <span className="truncate">{displayName || defaultName}</span>
                        <ExternalLink size={14} className="opacity-50 shrink-0" />
                    </a>
                ) : (
                    <span className="text-lg sm:text-xl font-bold text-base-content truncate">{displayName || defaultName}</span>
                )}
            </div>
            
            <button
                onClick={(e) => {
                    e.preventDefault();
                    startEditing();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-base-200 text-base-content/50 hover:text-primary shrink-0 mt-0.5"
                title={t('course.setNickname')}
            >
                <Pencil size={15} />
            </button>
        </div>
    );
}
