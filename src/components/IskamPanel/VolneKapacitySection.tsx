import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { cs as csLocale } from 'date-fns/locale';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ISKAM_CAMPUSES, academicYearDates } from '../../api/iskam/volneKapacity'; // academicYearDates used for default month init
import type { VolneKapacityRoom } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';

function monthToOdCz(month: Date): string {
    return `01.${String(month.getMonth() + 1).padStart(2, '0')}.${month.getFullYear()}`;
}

function dooFromMonth(month: Date): string {
    const endYear = month.getMonth() >= 8 ? month.getFullYear() + 1 : month.getFullYear();
    return `30.06.${endYear}`;
}

function isGapMonth(month: Date): boolean {
    const m = month.getMonth();
    return m === 6 || m === 7; // July (6) or August (7)
}

function fetchBlockViaContentScript(blockId: string, od: string, doo: string): Promise<VolneKapacityRoom[]> {
    return new Promise(resolve => {
        const id = crypto.randomUUID();
        const handler = (event: MessageEvent) => {
            if (event.source !== window.parent) return;
            if (event.data?.type !== 'ISKAM_BLOCK_RESULT' || event.data.id !== id) return;
            window.removeEventListener('message', handler);
            resolve((event.data.rooms as VolneKapacityRoom[]) ?? []);
        };
        window.addEventListener('message', handler);
        window.parent.postMessage({ type: 'ISKAM_FETCH_BLOCK', id, blockId, od, doo }, '*');
    });
}

function groupByFloor(rooms: VolneKapacityRoom[]): Record<string, VolneKapacityRoom[]> {
    return rooms.reduce<Record<string, VolneKapacityRoom[]>>((acc, r) => {
        (acc[r.floor] ??= []).push(r);
        return acc;
    }, {});
}

interface BlockData { label: string; rooms: VolneKapacityRoom[] }
interface CampusState { blocks: BlockData[]; fetching: boolean; expanded: boolean }
interface Props { language: IskamLanguage }

export function VolneKapacitySection({ language }: Props) {
    const t = createIskamT(language);
    const [open, setOpen] = useState(false);
    const [campuses, setCampuses] = useState<Record<string, CampusState>>({});
    const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>({});

    const toggleFloor = (key: string) => setExpandedFloors(prev => ({ ...prev, [key]: !prev[key] }));
    const [month, setMonth] = useState<Date>(() => {
        const { od } = academicYearDates();
        const [, m, y] = od.split('.');
        return new Date(parseInt(y), parseInt(m) - 1, 1);
    });

    const shiftMonth = (delta: 1 | -1) => {
        setMonth(prev => delta === 1 ? addMonths(prev, 1) : subMonths(prev, 1));
        setCampuses({});
    };

    const fetchCampus = async (campusName: string, blocks: { id: string; label: string }[], fetchMonth: Date) => {
        const od = monthToOdCz(fetchMonth);
        const doo = dooFromMonth(fetchMonth);
        setCampuses(prev => ({ ...prev, [campusName]: { blocks: [], fetching: true, expanded: true } }));
        for (const block of blocks) {
            const rooms = await fetchBlockViaContentScript(block.id, od, doo).catch(() => [] as VolneKapacityRoom[]);
            setCampuses(prev => {
                const campus = prev[campusName];
                if (!campus) return prev;
                return { ...prev, [campusName]: { ...campus, blocks: [...campus.blocks, { label: block.label, rooms }] } };
            });
        }
        setCampuses(prev => {
            const campus = prev[campusName];
            if (!campus) return prev;
            return { ...prev, [campusName]: { ...campus, fetching: false } };
        });
    };

    const handleCampus = (campusName: string, blocks: { id: string; label: string }[]) => {
        const state = campuses[campusName];
        if (!state) { fetchCampus(campusName, blocks, month); return; }
        setCampuses(prev => ({ ...prev, [campusName]: { ...prev[campusName], expanded: !prev[campusName].expanded } }));
    };

    return (
        <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-base-200/50 transition-colors"
            >
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
                    {t('iskam.freeRoomsLabel')}
                </span>
                {open ? <ChevronUp size={14} className="text-base-content/40" /> : <ChevronDown size={14} className="text-base-content/40" />}
            </button>

            {open && (
                <div className="flex flex-col border-t border-base-200">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-base-200/60">
                        <span className="text-xs text-base-content/40">{t('iskam.dateFrom')}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => shiftMonth(-1)} className="btn btn-ghost btn-xs btn-square">
                                <ChevronLeft size={12} />
                            </button>
                            <div className="flex flex-col items-center w-28">
                                <span className={`text-xs font-medium text-center capitalize ${isGapMonth(month) ? 'text-base-content/30' : ''}`}>
                                    {format(month, 'LLLL yyyy', { locale: language === 'en' ? undefined : csLocale })}
                                </span>
                                {isGapMonth(month) && (
                                    <span className="text-[10px] text-warning/70 leading-tight">{t('iskam.gapMonth')}</span>
                                )}
                            </div>
                            <button onClick={() => shiftMonth(1)} className="btn btn-ghost btn-xs btn-square">
                                <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>

                    {ISKAM_CAMPUSES.map(campus => {
                        const state = campuses[campus.name];
                        const freeCount = state?.blocks.reduce((s, b) => s + b.rooms.reduce((bs, r) => bs + r.free, 0), 0) ?? null;
                        const isExpanded = state?.expanded ?? false;

                        return (
                            <div key={campus.name} className="border-b border-base-200/60 last:border-0">
                                <button
                                    onClick={() => handleCampus(campus.name, campus.blocks)}
                                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-base-200/40 transition-colors"
                                >
                                    <span className="text-sm font-medium">{campus.name}</span>
                                    <div className="flex items-center gap-2">
                                        {state?.fetching && <Loader2 size={12} className="animate-spin text-base-content/30" />}
                                        {freeCount !== null && (
                                            <span className={`badge badge-sm ${freeCount > 0 ? 'badge-primary' : 'badge-ghost opacity-50'}`}>
                                                {freeCount} {t('iskam.freeLabel')}
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronUp size={12} className="text-base-content/40" /> : <ChevronDown size={12} className="text-base-content/40" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-3 flex flex-col gap-3">
                                        {freeCount === 0 && !state.fetching && (
                                            <div className="text-xs text-base-content/30">{t('iskam.noFreeRooms')}</div>
                                        )}
                                        {state.blocks.map(block => {
                                            const freeRooms = block.rooms.filter(r => r.free > 0);
                                            const totalFree = freeRooms.reduce((s, r) => s + r.free, 0);
                                            if (totalFree === 0) return null;
                                            const byFloor = groupByFloor(freeRooms);
                                            return (
                                                <div key={block.label}>
                                                    <div className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-1">
                                                        {t('iskam.blockLabel')} {block.label}
                                                        <span className="ml-2 font-normal normal-case">({totalFree} {t('iskam.freeLabel')})</span>
                                                    </div>
                                                    {Object.entries(byFloor).map(([floor, rooms]) => {
                                                        const floorFree = rooms.reduce((s, r) => s + r.free, 0);
                                                        const floorKey = `${campus.name}-${block.label}-${floor}`;
                                                        const floorOpen = expandedFloors[floorKey] ?? false;
                                                        return (
                                                            <div key={floor} className="border-b border-base-200/40 last:border-0">
                                                                <button
                                                                    onClick={() => toggleFloor(floorKey)}
                                                                    className="flex items-center justify-between w-full py-1 pl-2 hover:bg-base-200/30 transition-colors rounded"
                                                                >
                                                                    <span className="text-xs text-base-content/60">{t('iskam.floorLabel')} {floor}</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs text-base-content/40">{floorFree} {t('iskam.freeLabel')}</span>
                                                                        {floorOpen ? <ChevronUp size={10} className="text-base-content/30" /> : <ChevronDown size={10} className="text-base-content/30" />}
                                                                    </div>
                                                                </button>
                                                                {floorOpen && (
                                                                    <div className="pl-4 pb-1">
                                                                        {rooms.map(r => (
                                                                            <div key={r.room} className="flex items-center justify-between py-0.5">
                                                                                <span className="text-xs text-base-content/50">{r.room}</span>
                                                                                <span className="text-xs text-base-content/35">{r.free} {t('iskam.freeLabel')}{r.nationalities && ` · ${r.nationalities}`}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                        {state.fetching && (
                                            <div className="flex items-center gap-2 text-xs text-base-content/30 animate-pulse">
                                                <Loader2 size={10} className="animate-spin" />
                                                {t('iskam.loadingRooms')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
