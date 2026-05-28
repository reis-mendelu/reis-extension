import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, Loader2, HelpCircle, Heading1 } from 'lucide-react';
import { useDocumentNote } from '../../hooks/data/useDocumentNote';
import { useTranslation } from '../../hooks/useTranslation';
import { parseNoteToBlocks, serializeBlocksToNote, type NoteBlock } from './utils/noteParser';

interface DocumentNoteEditorProps {
    courseCode: string;
    fileLink: string;
    fileName: string;
    onClose: () => void;
}

export function DocumentNoteEditor({ courseCode, fileLink, fileName, onClose }: DocumentNoteEditorProps) {
    const { t } = useTranslation();
    const { note, setNote, isLoading, isSaving, hasError } = useDocumentNote(courseCode, fileLink);
    const [blocks, setBlocks] = useState<NoteBlock[]>([]);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

    // Sync IndexedDB notes into blocks state ONLY on initial load or when file changes
    useEffect(() => {
        if (!isLoading) {
            setBlocks(parseNoteToBlocks(note));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, fileLink, courseCode]);

    // Global listener for Escape key to close the notes panel
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [onClose]);

    // Focus active block inputs dynamically
    useEffect(() => {
        if (!activeBlockId) return;
        const el = document.getElementById(`h-${activeBlockId}`) ||
                   document.getElementById(`q-${activeBlockId}`) || 
                   document.getElementById(`t-${activeBlockId}`) || 
                   document.getElementById(`a-${activeBlockId}`);
        el?.focus();
    }, [activeBlockId]);

    const adjustHeight = useCallback((el: HTMLTextAreaElement | null) => {
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, []);

    const saveBlocks = useCallback((newBlocks: NoteBlock[]) => {
        setBlocks(newBlocks);
        setNote(serializeBlocksToNote(newBlocks), fileName);
    }, [setNote, fileName]);

    const handleTextChange = useCallback((id: string, val: string) => {
        if (val === '> ') {
            const updated = blocks.map(b => b.id === id ? { ...b, type: 'toggle' as const, question: '', answer: '', isCollapsed: false } : b);
            saveBlocks(updated);
            setTimeout(() => document.getElementById(`q-${id}`)?.focus(), 50);
        } else if (val.startsWith('# ')) {
            const updated = blocks.map(b => b.id === id ? { ...b, type: 'heading' as const, level: 1 as const, content: val.slice(2) } : b);
            saveBlocks(updated);
            setTimeout(() => document.getElementById(`h-${id}`)?.focus(), 50);
        } else if (val.startsWith('## ')) {
            const updated = blocks.map(b => b.id === id ? { ...b, type: 'heading' as const, level: 2 as const, content: val.slice(3) } : b);
            saveBlocks(updated);
            setTimeout(() => document.getElementById(`h-${id}`)?.focus(), 50);
        } else if (val.startsWith('### ')) {
            const updated = blocks.map(b => b.id === id ? { ...b, type: 'heading' as const, level: 3 as const, content: val.slice(4) } : b);
            saveBlocks(updated);
            setTimeout(() => document.getElementById(`h-${id}`)?.focus(), 50);
        } else {
            const updated = blocks.map(b => b.id === id ? { ...b, content: val } : b);
            saveBlocks(updated);
        }
    }, [blocks, saveBlocks]);

    const handleCreateBlockAfter = useCallback((afterId: string) => {
        const newId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const idx = blocks.findIndex(b => b.id === afterId);
        const newBlocks = [...blocks];
        newBlocks.splice(idx + 1, 0, { id: newId, type: 'text', content: '' });
        saveBlocks(newBlocks);
        setActiveBlockId(newId);
    }, [blocks, saveBlocks]);

    const handleInsertBlock = useCallback((type: 'heading' | 'toggle') => {
        const newId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newBlock: NoteBlock = type === 'heading'
            ? { id: newId, type: 'heading', level: 1, content: '' }
            : { id: newId, type: 'toggle', question: '', answer: '', isCollapsed: false };
        const idx = activeBlockId ? blocks.findIndex(b => b.id === activeBlockId) : -1;
        const newBlocks = [...blocks];
        if (idx >= 0) newBlocks.splice(idx + 1, 0, newBlock);
        else newBlocks.push(newBlock);
        saveBlocks(newBlocks);
        setActiveBlockId(newId);
    }, [blocks, saveBlocks, activeBlockId]);

    const handleDeleteBlock = useCallback((id: string) => {
        if (blocks.length <= 1) return;
        const idx = blocks.findIndex(b => b.id === id);
        const prevBlock = blocks[idx - 1] || blocks[idx + 1];
        saveBlocks(blocks.filter(b => b.id !== id));
        if (prevBlock) setActiveBlockId(prevBlock.id);
    }, [blocks, saveBlocks]);

    const handleFocusNextBlock = useCallback((id: string, direction: 'up' | 'down') => {
        const idx = blocks.findIndex(b => b.id === id);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        const targetBlock = blocks[targetIdx];
        if (!targetBlock) return;
        
        const nextId = targetBlock.type === 'toggle' 
            ? (direction === 'up' && !targetBlock.isCollapsed ? `a-${targetBlock.id}` : `q-${targetBlock.id}`)
            : targetBlock.type === 'heading'
                ? `h-${targetBlock.id}`
                : `t-${targetBlock.id}`;
            
        document.getElementById(nextId)?.focus();
    }, [blocks]);

    const handleTextKeyDown = useCallback((id: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const val = e.currentTarget.value;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCreateBlockAfter(id);
        } else if (e.key === 'Backspace' && !val) {
            e.preventDefault();
            handleDeleteBlock(id);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleFocusNextBlock(id, 'up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleFocusNextBlock(id, 'down');
        }
    }, [handleCreateBlockAfter, handleDeleteBlock, handleFocusNextBlock]);

    const handleHeadingKeyDown = useCallback((id: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const val = e.currentTarget.value;
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCreateBlockAfter(id);
        } else if (e.key === 'Backspace' && !val) {
            e.preventDefault();
            const prefix = block.level === 2 ? '## ' : block.level === 3 ? '### ' : '# ';
            saveBlocks(blocks.map(b => b.id === id ? { id, type: 'text' as const, content: prefix } : b));
            setTimeout(() => {
                const el = document.getElementById(`t-${id}`) as HTMLTextAreaElement;
                if (el) {
                    el.focus();
                    el.setSelectionRange(prefix.length, prefix.length);
                }
            }, 50);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleFocusNextBlock(id, 'up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleFocusNextBlock(id, 'down');
        }
    }, [handleCreateBlockAfter, blocks, saveBlocks, handleFocusNextBlock]);

    const handleQuestionKeyDown = useCallback((id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
        const val = e.currentTarget.value;
        const selectionStart = e.currentTarget.selectionStart;
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: !b.isCollapsed } : b));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: false } : b));
            setTimeout(() => document.getElementById(`a-${id}`)?.focus(), 50);
        } else if (e.key === 'Backspace' && !val) {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { id, type: 'text' as const, content: b.answer || '' } : b));
            setTimeout(() => document.getElementById(`t-${id}`)?.focus(), 50);
        } else if (e.key === 'ArrowLeft' && selectionStart === 0 && !block.isCollapsed) {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: true } : b));
        } else if (e.key === 'ArrowRight' && selectionStart === 0 && block.isCollapsed) {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: false } : b));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleFocusNextBlock(id, 'up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!block.isCollapsed) {
                document.getElementById(`a-${id}`)?.focus();
            } else {
                handleFocusNextBlock(id, 'down');
            }
        }
    }, [blocks, saveBlocks, handleFocusNextBlock]);

    const handleAnswerKeyDown = useCallback((id: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const val = e.currentTarget.value;
        const selectionStart = e.currentTarget.selectionStart;
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: !b.isCollapsed } : b));
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCreateBlockAfter(id);
        } else if (e.key === 'Backspace' && !val) {
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: true } : b));
            setTimeout(() => document.getElementById(`q-${id}`)?.focus(), 50);
        } else if (e.key === 'ArrowLeft' && selectionStart === 0 && e.altKey) {
            // Require Alt key for ArrowLeft collapse to prevent cursor navigation conflicts
            e.preventDefault();
            saveBlocks(blocks.map(b => b.id === id ? { ...b, isCollapsed: true } : b));
            setTimeout(() => document.getElementById(`q-${id}`)?.focus(), 50);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            document.getElementById(`q-${id}`)?.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleFocusNextBlock(id, 'down');
        }
    }, [handleCreateBlockAfter, blocks, saveBlocks, handleFocusNextBlock]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-base-100">
                <span className="loading loading-spinner loading-lg text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-base-100 border-l border-base-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200/50 shrink-0">
                <div className="flex-1 min-w-0 mr-3">
                    <h3 className="text-sm font-semibold text-base-content truncate" title={fileName}>{fileName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        {hasError ? (
                            <span className="flex items-center gap-1 text-[10px] text-error font-medium">
                                <X size={10} className="text-error" />
                                {t('course.documentNote.saveError') || 'Save failed'}
                            </span>
                        ) : isSaving ? (
                            <span className="flex items-center gap-1 text-[10px] text-primary/70 animate-pulse font-medium">
                                <Loader2 size={10} className="animate-spin" />
                                {t('course.documentNote.saving')}
                            </span>
                        ) : (
                            note && <span className="flex items-center gap-0.5 text-[10px] text-success font-medium"><ChevronRight size={10} className="text-success" />{t('course.documentNote.saved')}</span>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="btn btn-ghost btn-xs btn-square"><X size={14} /></button>
            </div>

            {/* Note Content List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 font-sans">
                {blocks.map((block) => (
                    <div key={block.id} className="group relative flex items-start gap-1 py-0.5">
                        {block.type === 'toggle' ? (
                            <div className="flex flex-col w-full space-y-1">
                                <div className="flex items-center gap-1.5 w-full">
                                    <button
                                        onClick={() => saveBlocks(blocks.map(b => b.id === block.id ? { ...b, isCollapsed: !b.isCollapsed } : b))}
                                        className="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-base-200 text-base-content/50 transition-colors focus:outline-none"
                                    >
                                        <ChevronRight size={14} className={`transition-transform duration-200 ${!block.isCollapsed ? 'rotate-90 text-primary' : ''}`} />
                                    </button>
                                    <input
                                        id={`q-${block.id}`}
                                        type="text"
                                        value={block.question}
                                        onChange={(e) => saveBlocks(blocks.map(b => b.id === block.id ? { ...b, question: e.target.value } : b))}
                                        onKeyDown={(e) => handleQuestionKeyDown(block.id, e)}
                                        placeholder={t('course.documentNote.questionPlaceholder')}
                                        className="flex-1 bg-transparent focus:outline-none text-sm font-semibold text-base-content placeholder:text-base-content/30 border-0 p-0 focus:ring-0"
                                    />
                                </div>
                                {!block.isCollapsed && (
                                    <div className="pl-6 border-l border-base-300 ml-2.5 py-0.5 animate-in slide-in-from-top-1 duration-150">
                                        <textarea
                                            id={`a-${block.id}`}
                                            ref={adjustHeight}
                                            value={block.answer}
                                            onChange={(e) => {
                                                adjustHeight(e.target);
                                                saveBlocks(blocks.map(b => b.id === block.id ? { ...b, answer: e.target.value } : b));
                                            }}
                                            onKeyDown={(e) => handleAnswerKeyDown(block.id, e)}
                                            placeholder={t('course.documentNote.answerPlaceholder')}
                                            rows={1}
                                            className="w-full bg-transparent resize-none focus:outline-none text-sm text-base-content/80 leading-relaxed border-0 p-0 focus:ring-0"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : block.type === 'heading' ? (
                            <div className="flex items-start gap-1.5 w-full">
                                <div className="w-5 h-5 shrink-0 flex items-center justify-center text-base-content/25 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                                    <span className="text-[10px] font-mono font-bold text-base-content/40">H{block.level}</span>
                                </div>
                                <textarea
                                    id={`h-${block.id}`}
                                    ref={adjustHeight}
                                    value={block.content || ''}
                                    onChange={(e) => {
                                        adjustHeight(e.target);
                                        saveBlocks(blocks.map(b => b.id === block.id ? { ...b, content: e.target.value } : b));
                                    }}
                                    onKeyDown={(e) => handleHeadingKeyDown(block.id, e)}
                                    placeholder={
                                        block.level === 1 ? t('course.documentNote.heading1Placeholder') || 'Heading 1' :
                                        block.level === 2 ? t('course.documentNote.heading2Placeholder') || 'Heading 2' :
                                        t('course.documentNote.heading3Placeholder') || 'Heading 3'
                                    }
                                    rows={1}
                                    className={`flex-1 bg-transparent resize-none focus:outline-none border-0 p-0 focus:ring-0 leading-tight ${
                                        block.level === 1 ? 'text-lg font-bold text-base-content' :
                                        block.level === 2 ? 'text-base font-semibold text-base-content/90' :
                                        'text-sm font-semibold text-base-content/80'
                                    }`}
                                />
                            </div>
                        ) : (
                            <div className="flex items-start gap-1.5 w-full">
                                <div className="tooltip tooltip-left w-5 h-5 shrink-0 flex items-center justify-center text-base-content/25 opacity-0 group-hover:opacity-100 transition-opacity select-none" data-tip={t('course.documentNote.toggleTitle')}>
                                    <HelpCircle size={12} className="text-base-content/30" />
                                </div>
                                <textarea
                                    id={`t-${block.id}`}
                                    ref={adjustHeight}
                                    value={block.content}
                                    onChange={(e) => {
                                        adjustHeight(e.target);
                                        handleTextChange(block.id, e.target.value);
                                    }}
                                    onKeyDown={(e) => handleTextKeyDown(block.id, e)}
                                    placeholder={t('course.documentNote.textPlaceholder')}
                                    rows={1}
                                    className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-base-content leading-relaxed border-0 p-0 focus:ring-0"
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Block insert toolbar — visible alternative to markdown shortcuts */}
            <div className="flex items-center gap-1 px-3 py-2 border-t border-base-300 bg-base-200/50 shrink-0">
                <button
                    onClick={() => handleInsertBlock('toggle')}
                    className="btn btn-ghost btn-xs gap-1 text-primary/80 hover:text-primary"
                >
                    <HelpCircle size={13} />
                    {t('course.documentNote.addCard')}
                </button>
                <button
                    onClick={() => handleInsertBlock('heading')}
                    className="btn btn-ghost btn-xs gap-1 text-base-content/60 hover:text-base-content/90"
                >
                    <Heading1 size={13} />
                    {t('course.documentNote.addHeading')}
                </button>
            </div>
        </div>
    );
}
