import { Info } from 'lucide-react';

export function RequirementsSection({ text }: { text: string }) {
    const highlight = (t: string) => t.split(/((?:min\.|max\.)?\s*\d+(?:[.,]\d+)?\s*(?:bodů|bodu|body|b\.|%)|(?:A|B|C|D|E|F)\s*\([^)]+\)|Zkouška|Zápočet)/g).map((p, i) => {
        if (p.match(/(?:min\.|max\.)?\s*\d+(?:[.,]\d+)?\s*(?:bodů|bodu|body|b\.|%)/)) return <span key={i} className="font-bold text-primary">{p}</span>;
        if (p.match(/^(?:A|B|C|D|E|F)\s*\([^)]+\)/)) return <span key={i} className="font-bold text-base-content">{p}</span>;
        if (p === 'Zkouška' || p === 'Zápočet') return <span key={i} className="font-semibold underline decoration-primary/30 decoration-2 underline-offset-2">{p}</span>;
        return p;
    });

    return (
        <div className="prose prose-sm max-w-none">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Info size={18} className="text-primary" /> Podmínky ukončení</h3>
            <div className="bg-base-200/30 rounded-xl p-5 border border-base-200">
                {text.split('\n').filter(l => l.trim()).map((l, i) => {
                    const trimmed = l.trim();
                    if (trimmed.startsWith('-') || trimmed.startsWith('•')) return <div key={i} className="flex gap-3 ml-1 mb-2"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /><span className="opacity-80 leading-relaxed">{highlight(trimmed.substring(1).trim())}</span></div>;
                    if (trimmed.match(/^[A-F] \(/)) return <div key={i} className="flex flex-wrap gap-2 my-2">{trimmed.split(/, ?(?=[A-F] \()/).map((g, gi) => <span key={gi} className="badge badge-ghost py-3 h-auto text-xs">{g.trim()}</span>)}</div>;
                    if (trimmed.length < 50 && trimmed.endsWith(':')) return <h4 key={i} className="font-bold mt-4 mb-2">{trimmed}</h4>;
                    return <p key={i} className="mb-3 opacity-80 leading-relaxed last:mb-0">{highlight(trimmed)}</p>;
                })}
            </div>
        </div>
    );
}
