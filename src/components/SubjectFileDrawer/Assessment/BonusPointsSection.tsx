import { X } from 'lucide-react';

interface BonusPointsSectionProps {
    bonusPoints: Record<string, { name: string; points: number }>;
    onUpdate: (id: string, name: string, points: number) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
}

export function BonusPointsSection({ bonusPoints, onUpdate, onRemove, onAdd }: BonusPointsSectionProps) {
    if (Object.keys(bonusPoints).length === 0) return null;
    return (
        <div className="flex-shrink-0 border-t border-base-300 bg-base-100 p-3">
            <div className="text-xs font-semibold text-base-content/60 mb-2">Bonusové body</div>
            <div className="space-y-2">
                {Object.entries(bonusPoints).map(([id, bonus]) => (
                    <div key={id} className="flex items-center gap-2">
                        <input type="text" className="input input-xs input-bordered flex-1" value={bonus.name} onChange={e => onUpdate(id, e.target.value, bonus.points)} placeholder="Název" />
                        <span className="text-base-content/60">:</span>
                        <input type="text" inputMode="numeric" className="input input-xs input-bordered w-16 text-right" value={bonus.points || ''} onChange={e => {
                            const val = e.target.value.replace(/[^0-9.-]/g, '');
                            onUpdate(id, bonus.name, val ? parseFloat(val) : 0);
                        }} placeholder="0" />
                        <span className="text-xs text-base-content/60">bodů</span>
                        <button onClick={() => onRemove(id)} className="btn btn-ghost btn-xs text-error"><X size={14} /></button>
                    </div>
                ))}
                <button onClick={onAdd} className="btn btn-ghost btn-xs w-full text-primary">+ Přidat bonus</button>
            </div>
        </div>
    );
}
