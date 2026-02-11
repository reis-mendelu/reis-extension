import { X } from 'lucide-react';

interface ModalHeaderProps {
    title: string;
    description: string;
    onClose: () => void;
}

export function ModalHeader({ title, description, onClose }: ModalHeaderProps) {
    return (
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-white/40 bg-base-100/80 backdrop-blur shrink-0 mb-5">
            <div>
                <h2 className="text-xl font-bold text-base-content">{title}</h2>
                {description && <p className="text-sm text-base-content/60 mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-circle" aria-label="Zavřít"><X size={20} /></button>
        </div>
    );
}
