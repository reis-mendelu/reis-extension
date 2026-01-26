import { useState } from 'react';
import { Mail, MessageCircle, Star, Send, X, AlertCircle } from 'lucide-react';

export function FeedbackModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [rating, setRating] = useState(0), [text, setText] = useState(''), [sent, setSent] = useState(false);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-base-content/20 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-base-100 w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-base-300 animate-in zoom-in-95 duration-200">
                <div className="bg-primary p-6 text-primary-content relative"><h2 className="text-2xl font-bold flex items-center gap-2"><MessageCircle /> Vaše zpětná vazba</h2><p className="text-primary-content/80 text-sm mt-1">Pomozte nám reIS vylepšit. Každý postřeh se počítá!</p><button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button></div>
                {sent ? <div className="p-12 text-center animate-in fade-in zoom-in-95"><div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4"><Send size={32} /></div><h3 className="text-xl font-bold">Děkujeme!</h3><p className="text-base-content/60 mt-2">Vaše zpráva byla úspěšně odeslána. </p><button onClick={onClose} className="btn btn-primary mt-8 px-8">Zavřít</button></div>
                : <div className="p-6 space-y-6">
                    <div className="space-y-3"><label className="text-sm font-bold opacity-40 uppercase tracking-widest pl-1">Jak jste spokojeni?</label><div className="flex gap-2 justify-between bg-base-200 p-3 rounded-xl">{[1, 2, 3, 4, 5].map(s => <button key={s} onClick={() => setRating(s)} className={`flex-1 py-4 rounded-lg transition-all flex flex-col items-center gap-1 ${rating >= s ? 'bg-primary text-primary-content shadow-lg scale-105' : 'hover:bg-base-300 opacity-50'}`}><Star fill={rating >= s ? "currentColor" : "none"} size={24} /><span className="text-[10px] font-bold">{s === 1 ? 'Eh' : s === 5 ? 'Top' : s}</span></button>)}</div></div>
                    <div className="space-y-3"><label className="text-sm font-bold opacity-40 uppercase tracking-widest pl-1">Co můžeme zlepšit?</label><div className="relative"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Napište nám, co vás pálí nebo co byste si přáli..." className="textarea textarea-bordered w-full h-32 focus:border-primary transition-all pr-10 resize-none" /><MessageCircle className="absolute top-4 right-4 opacity-10" /></div></div>
                    <div className="bg-amber-50 rounded-xl p-4 flex gap-3 border border-amber-100 text-amber-800"><AlertCircle className="shrink-0" size={20} /><p className="text-xs leading-relaxed font-medium">Pokud hlásíte chybu, uveďte prosím co nejvíce podrobností. Odpovíme vám do Outlooku.</p></div>
                    <div className="flex gap-3 pt-2"><button onClick={onClose} className="btn flex-1">Zrušit</button><button onClick={() => setSent(true)} disabled={!text || !rating} className="btn btn-primary flex-1 gap-2"><Send size={18} /> Odeslat</button></div>
                    <div className="flex items-center justify-center gap-2 opacity-20 text-[10px] font-bold uppercase tracking-widest"><Mail size={12} /> reis@mendelu.cz</div>
                </div>}
            </div>
        </div>
    );
}
