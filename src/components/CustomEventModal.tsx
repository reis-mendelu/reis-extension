import { useState } from 'react';
import { Calendar } from 'lucide-react';
import type { CalendarCustomEvent } from '../types/calendarTypes';

interface CustomEventModalProps {
    mode: 'create' | 'edit';
    initialDate?: string;
    initialStart?: string;
    initialEnd?: string;
    event?: CalendarCustomEvent;
    onSave: (eventData: Omit<CalendarCustomEvent, 'id'>) => void;
    onDelete?: () => void;
    onClose: () => void;
}

const inputCls = 'input input-bordered w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all';

export function CustomEventModal({ mode, initialDate, initialStart, initialEnd, event, onSave, onDelete, onClose }: CustomEventModalProps) {
    const [title, setTitle] = useState(event?.title ?? '');
    const [room, setRoom] = useState(event?.room ?? '');
    const [startTime, setStartTime] = useState(event?.startTime ?? initialStart ?? '');
    const [endTime, setEndTime] = useState(event?.endTime ?? initialEnd ?? '');
    const date = event?.date ?? initialDate ?? '';

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !date || !startTime || !endTime) return;
        onSave({ title: title.trim(), room: room.trim() || undefined, date, startTime, endTime });
    };

    return (
        <dialog className="modal modal-open">
            <div className="modal-box max-w-sm">
                <div className="flex items-center gap-2 text-primary font-semibold mb-4">
                    <Calendar className="w-4 h-4" />
                    <span className="text-base">{mode === 'create' ? 'Nový osobní event' : 'Upravit event'}</span>
                </div>

                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="label py-1"><span className="label-text font-medium text-sm">Název</span></label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Např. studium, konzultace…"
                            className={inputCls}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label py-1"><span className="label-text font-medium text-sm">Od</span></label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <div>
                            <label className="label py-1"><span className="label-text font-medium text-sm">Do</span></label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label py-1"><span className="label-text font-medium text-sm">Místnost <span className="text-base-content/40 font-normal">(volitelné)</span></span></label>
                        <input
                            type="text"
                            value={room}
                            onChange={e => setRoom(e.target.value)}
                            placeholder="Např. Q01, knihovna…"
                            className={inputCls}
                        />
                    </div>

                    <div className="modal-action mt-4 pt-3 border-t border-base-200">
                        {mode === 'edit' && onDelete ? (
                            <button type="button" onClick={onDelete} className="btn btn-error btn-outline btn-sm mr-auto">Smazat</button>
                        ) : null}
                        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Zrušit</button>
                        <button type="submit" disabled={!title.trim()} className="btn btn-primary btn-sm">Uložit</button>
                    </div>
                </form>
            </div>

            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
}
