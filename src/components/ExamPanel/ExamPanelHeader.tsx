/**
 * ExamPanel Header Component
 */

import { ExternalLink } from 'lucide-react';

import { useUserParams } from '../../hooks/useUserParams';

export function ExamPanelHeader() {
    const { params } = useUserParams();
    const studium = params?.studium || '';
    const obdobi = params?.obdobi || '';

    const href = studium && obdobi
        ? `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${studium};obdobi=${obdobi};lang=cz`
        : "https://is.mendelu.cz/auth/student/prihlasovani_zkousky.pl";

    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200 bg-base-100">
            <h2 className="text-lg font-semibold text-base-content">Zápisy na zkoušky</h2>
            <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary"
            >
                <span>IS MENDELU</span>
                <ExternalLink size={16} />
            </a>
        </div>
    );
}

/**
 * Auto-booking Banner Component
 */
interface AutoBookingBannerProps {
    isActive: boolean;
    onCancel: () => void;
}

export function AutoBookingBanner({ isActive, onCancel }: AutoBookingBannerProps) {
    if (!isActive) return null;

    return (
        <div className="flex items-center gap-3 px-6 py-2 bg-warning/10 border-b border-warning/20">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span className="text-sm text-warning font-medium">
                Auto-rezervace aktivní. Nezavírejte tuto stránku!
            </span>
            <button
                onClick={onCancel}
                className="btn btn-ghost btn-xs ml-auto"
            >
                Zrušit
            </button>
        </div>
    );
}
