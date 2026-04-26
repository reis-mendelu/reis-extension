import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { ISKAM_CAMPUSES } from '../../api/iskam/volneKapacity';
import type { VolneKapacityRoom } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';

function fetchBlockViaContentScript(blockId: string): Promise<VolneKapacityRoom[]> {
    return new Promise(resolve => {
        const id = crypto.randomUUID();
        const handler = (event: MessageEvent) => {
            if (event.source !== window.parent) return;
            if (event.data?.type !== 'ISKAM_BLOCK_RESULT' || event.data.id !== id) return;
            window.removeEventListener('message', handler);
            resolve((event.data.rooms as VolneKapacityRoom[]) ?? []);
        };
        window.addEventListener('message', handler);
        console.log('[reIS:iskam] sending ISKAM_FETCH_BLOCK', { blockId, id });
        window.parent.postMessage({ type: 'ISKAM_FETCH_BLOCK', id, blockId }, '*');
    });
}

interface BlockData { label: string; rooms: VolneKapacityRoom[] }
interface CampusState { blocks: BlockData[]; fetching: boolean; expanded: boolean }

interface Props { language: IskamLanguage }

export function VolneKapacitySection({ language }: Props) {
    const t = createIskamT(language);
    const [open, setOpen] = useState(false);
    const [campuses, setCampuses] = useState<Record<string, CampusState>>({});

    const fetchCampus = async (campusName: string, blocks: { id: string; label: string }[]) => {
        setCampuses(prev => ({ ...prev, [campusName]: { blocks: [], fetching: true, expanded: true } }));
        for (const block of blocks) {
            const rooms = await fetchBlockViaContentScript(block.id).catch(() => [] as VolneKapacityRoom[]);
            setCampuses(prev => ({
                ...prev,
                [campusName]: { ...prev[campusName], blocks: [...prev[campusName].blocks, { label: block.label, rooms }] },
            }));
        }
        setCampuses(prev => ({ ...prev, [campusName]: { ...prev[campusName], fetching: false } }));
    };

    const handleCampus = (campusName: string, blocks: { id: string; label: string }[]) => {
        const state = campuses[campusName];
        if (!state) { fetchCampus(campusName, blocks); return; }
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
                    {ISKAM_CAMPUSES.map(campus => {
                        const state = campuses[campus.name];
                        const freeCount = state?.blocks.reduce((s, b) => s + b.rooms.filter(r => r.free > 0).length, 0) ?? null;
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
                                                {freeCount}
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronUp size={12} className="text-base-content/40" /> : <ChevronDown size={12} className="text-base-content/40" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-3 flex flex-col gap-3">
                                        {state.blocks.map(block => {
                                            const freeRooms = block.rooms.filter(r => r.free > 0);
                                            return (
                                                <div key={block.label}>
                                                    <div className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-1">
                                                        {t('iskam.blockLabel')} {block.label}
                                                        <span className="ml-2 font-normal normal-case">({freeRooms.length} {t('iskam.freeLabel')})</span>
                                                    </div>
                                                    {freeRooms.length === 0 ? (
                                                        <div className="text-xs text-base-content/30">{t('iskam.noFreeRooms')}</div>
                                                    ) : freeRooms.map(r => (
                                                        <div key={r.room} className="flex items-center justify-between py-1 border-b border-base-200/40 last:border-0">
                                                            <span className="text-xs">{r.room} · {t('iskam.floorLabel')} {r.floor}</span>
                                                            <span className="text-xs text-base-content/50">{r.free}/{r.beds}{r.nationalities && ` · ${r.nationalities}`}</span>
                                                        </div>
                                                    ))}
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
