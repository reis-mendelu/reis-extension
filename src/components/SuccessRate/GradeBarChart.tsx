interface GradeBarChartProps {
    grades: Record<string, number>;
    order: string[];
    colors: Record<string, string>;
    max: number;
}

export function GradeBarChart({ grades, order, colors, max }: GradeBarChartProps) {
    const H = 160, MAX_B = 110;
    return (
        <div className="flex items-end gap-3 px-1 mb-8 relative" style={{ height: `${H}px` }}>
            {order.map((g: string) => {
                const v = grades[g] || 0, h = (v / max) * MAX_B;
                return (
                    <div key={g} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className={`text-2xs font-bold transition-opacity ${v > 0 ? 'text-base-content/40 group-hover:text-base-content/100' : 'opacity-0'}`}>{v}</span>
                        <div className="w-full rounded-t-md transition-all duration-300 shadow-sm" style={{ height: `${Math.max(h, 4)}px`, backgroundColor: v > 0 ? colors[g] : 'var(--color-base-content)', opacity: v > 0 ? 1 : 0.05 }} />
                        <span className="text-2xs font-black text-base-content/30 mt-1 uppercase">{g === 'FN' ? '-' : g}</span>
                    </div>
                );
            })}
        </div>
    );
}
