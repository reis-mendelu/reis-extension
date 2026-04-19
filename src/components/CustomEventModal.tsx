import { useState, useEffect, useRef } from 'react';
import { X, Clock, MapPin } from 'lucide-react';
import type { CalendarCustomEvent } from '../types/calendarTypes';

interface CustomEventModalProps {
    mode: 'create' | 'edit';
    initialDate?: string;   // YYYYMMDD
    initialStart?: string;  // HH:MM
    initialEnd?: string;    // HH:MM
    event?: CalendarCustomEvent;
    anchor?: { x: number; y: number };
    onSave: (data: Omit<CalendarCustomEvent, 'id'>) => void;
    onDelete?: () => void;
    onClose: () => void;
}

function formatDateLabel(yyyymmdd: string): string {
    if (!yyyymmdd || yyyymmdd.length !== 8) return '';
    const y = parseInt(yyyymmdd.slice(0, 4));
    const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
    const d = parseInt(yyyymmdd.slice(6, 8));
    return new Date(y, m, d).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'long' });
}

const POPOVER_W = 300;
const POPOVER_H = 280;

export function CustomEventModal({ mode, initialDate, initialStart, initialEnd, event, anchor, onSave, onDelete, onClose }: CustomEventModalProps) {
    const [title, setTitle] = useState(event?.title ?? '');
    const [startTime, setStartTime] = useState(event?.startTime ?? initialStart ?? '');
    const [endTime, setEndTime] = useState(event?.endTime ?? initialEnd ?? '');
    const [room, setRoom] = useState(event?.room ?? '');
    const [showRoom, setShowRoom] = useState(!!(event?.room));
    const date = event?.date ?? initialDate ?? '';
    const titleRef = useRef<HTMLInputElement>(null);

    const pos = (() => {
        if (!anchor) return null;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = anchor.x + 14;
        let y = anchor.y - 24;
        if (x + POPOVER_W > vw - 8) x = anchor.x - POPOVER_W - 14;
        if (y + POPOVER_H > vh - 8) y = vh - POPOVER_H - 8;
        if (y < 8) y = 8;
        return { left: Math.max(8, x), top: y };
    })();

    useEffect(() => { titleRef.current?.focus(); }, []);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSave = () => {
        if (!title.trim() || !date || !startTime || !endTime) return;
        onSave({ title: title.trim(), date, startTime, endTime, room: room.trim() || undefined });
    };

    const timeCls = 'w-[104px] bg-base-200 rounded-lg px-2 py-1.5 text-sm border-none outline-none focus:ring-1 focus:ring-primary/40 focus:bg-base-300 transition-all tabular-nums';

    const box = (
        <div
            className="bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden"
            style={pos ? { position: 'fixed', ...pos, zIndex: 9999, width: POPOVER_W } : { width: '100%' }}
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-end px-3 pt-3">
                <button type="button" onClick={onClose} className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-base-content">
                    <X size={14} />
                </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
                {/* Title */}
                <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    placeholder="Přidat název"
                    className="w-full bg-transparent border-b-2 border-base-300 focus:border-primary outline-none text-lg font-medium text-base-content placeholder:text-base-content/30 pb-1 transition-colors"
                />

                {/* Date + time — two rows */}
                <div className="flex items-start gap-2">
                    <Clock size={14} className="shrink-0 text-base-content/40 mt-1" />
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-base-content/55">{formatDateLabel(date)}</span>
                        <div className="flex items-center gap-2">
                            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={timeCls} />
                            <span className="text-base-content/40 text-sm">–</span>
                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={timeCls} />
                        </div>
                    </div>
                </div>

                {/* Location */}
                {showRoom ? (
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="shrink-0 text-base-content/40" />
                        <input
                            type="text"
                            value={room}
                            onChange={e => setRoom(e.target.value)}
                            placeholder="Místnost nebo místo"
                            className="flex-1 bg-transparent border-b border-base-300 focus:border-primary outline-none text-sm text-base-content placeholder:text-base-content/30 pb-0.5 transition-colors"
                            autoFocus
                        />
                    </div>
                ) : (
                    <button type="button" onClick={() => setShowRoom(true)}
                        className="flex items-center gap-2 text-sm text-base-content/40 hover:text-base-content/70 transition-colors w-full">
                        <MapPin size={14} />
                        <span>Přidat místo</span>
                    </button>
                )}

                {/* Actions */}
                <div className="flex items-center pt-2">
                    {mode === 'edit' && onDelete ? (
                        <button type="button" onClick={onDelete} className="text-xs text-error/60 hover:text-error transition-colors">Smazat</button>
                    ) : null}
                    <div className="flex items-center gap-2 ml-auto">
                        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm text-base-content/50">Zrušit</button>
                        <button type="button" onClick={handleSave} disabled={!title.trim()} className="btn btn-primary btn-sm rounded-full px-5 disabled:opacity-40">Uložit</button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (pos) {
        return (
            <>
                <div className="fixed inset-0 z-[9998]" onClick={onClose} />
                {box}
            </>
        );
    }

    // Centered fallback for edit without anchor — no <form method="dialog"> (sandboxed iframe blocks it)
    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30" onClick={onClose}>
            <div className="max-w-xs w-full mx-4">{box}</div>
        </div>
    );
}
