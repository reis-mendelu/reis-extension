import { X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface BonusPointsSectionProps {
    bonusPoints: Record<string, { name: string; points: number }>;
    onUpdate: (id: string, name: string, points: number) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
}

export function BonusPointsSection({ bonusPoints, onUpdate, onRemove, onAdd }: BonusPointsSectionProps) {
    const { t, language } = useTranslation();
    if (Object.keys(bonusPoints).length === 0) return null;

    const formatNumberInput = (value: string) => {
        if (language === 'cs') {
            return value.replace(',', '.').replace(/[^0-9.-]/g, '');
        }
        return value.replace(/[^0-9.-]/g, '');
    };

    const displayFormattedNumber = (num: number | string) => {
        if (num === null || num === undefined || num === '') return '';
        const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
        if (isNaN(parsedNum)) return '';
        if (language === 'cs') {
            return parsedNum.toString().replace('.', ',');
        }
        return parsedNum.toString();
    };

    return (
        <div className="flex-shrink-0 border-t border-base-300 bg-base-100 p-3">
            <div className="text-xs font-semibold text-base-content/60 mb-2">{t('assessment.bonusTitle')}</div>
            <div className="space-y-2">
                {Object.entries(bonusPoints).map(([id, bonus]) => (
                    <div key={id} className="flex items-center gap-2">
                        <input type="text" className="input input-xs input-bordered flex-1" value={bonus.name} onChange={e => onUpdate(id, e.target.value, bonus.points)} placeholder={t('assessment.bonusNamePlaceholder')} />
                        <span className="text-base-content/60">:</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            className="input input-xs input-bordered w-16 text-right"
                            value={displayFormattedNumber(bonus.points)}
                            onChange={e => {
                                const val = formatNumberInput(e.target.value);
                                onUpdate(id, bonus.name, val ? parseFloat(val) : 0);
                            }}
                            placeholder="0"
                        />
                        <span className="text-xs text-base-content/60">{t('assessment.points')}</span>
                        <button onClick={() => onRemove(id)} className="btn btn-ghost btn-xs text-error"><X size={14} /></button>
                    </div>
                ))}
                <button onClick={onAdd} className="btn btn-ghost btn-xs w-full text-primary">+ {t('assessment.addBonus')}</button>
            </div>
        </div>
    );
}
