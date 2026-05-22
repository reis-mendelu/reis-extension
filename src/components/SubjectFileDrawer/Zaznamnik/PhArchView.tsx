import type { PhSection } from '../../../types/zaznamnik';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
    sections: PhSection[];
}

export function PhArchView({ sections }: Props) {
    const { t } = useTranslation();
    const hasAny = sections.some(s => s.arches.some(a => !a.empty));
    if (!hasAny) return null;

    return (
        <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/40">
                {t('zaznamnik.phSection')}
            </p>
            {sections.map((section, si) => (
                <div key={si} className="space-y-2">
                    {section.label && (
                        <p className="text-[11px] text-base-content/50 font-medium">{section.label}</p>
                    )}
                    {section.arches.map((arch, ai) => (
                        <div key={ai} className="bg-base-200/60 rounded-lg px-3 py-2">
                            <p className="text-[11px] font-semibold text-base-content/60 mb-1">{arch.name}</p>
                            {arch.empty ? (
                                <p className="text-[12px] text-base-content/30">—</p>
                            ) : arch.columns.length === 1 ? (
                                <p className="text-[12px] font-medium text-base-content">
                                    <span className="text-base-content/50">{arch.columns[0]}: </span>
                                    {arch.values[0]}
                                </p>
                            ) : (
                                <div className="overflow-x-auto w-full custom-scrollbar pb-1">
                                    <div className="grid gap-x-3 gap-y-0.5 w-full" style={{ gridTemplateColumns: `repeat(${arch.columns.length}, minmax(40px, 1fr))` }}>
                                        {arch.columns.map((col, ci) => (
                                            <p key={ci} className="text-[10px] text-base-content/40 truncate" title={col}>{col}</p>
                                        ))}
                                        {arch.values.map((val, vi) => (
                                            <p key={vi} className="text-[12px] font-medium text-base-content truncate" title={val}>{val}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
