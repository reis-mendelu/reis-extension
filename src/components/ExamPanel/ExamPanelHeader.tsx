/**
 * ExamPanel Header Component
 */

import { ExternalLink } from 'lucide-react';

import { useUserParams } from '../../hooks/useUserParams';
import { useTranslation } from '../../hooks/useTranslation';

export function ExamPanelHeader() {
    const { t, language } = useTranslation();
    const { params } = useUserParams();
    const studium = params?.studium || '';
    const obdobi = params?.obdobi || '';

    const href = studium && obdobi
        ? `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${studium};obdobi=${obdobi};lang=${language === 'cs' ? 'cz' : 'en'}`
        : `https://is.mendelu.cz/auth/student/prihlasovani_zkousky.pl?lang=${language === 'cs' ? 'cz' : 'en'}`;

    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200 bg-base-100">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-base-content tracking-tight">{t('exams.registrationTitle')}</h2>
            </div>
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
    const { t } = useTranslation();
    if (!isActive) return null;

    return (
        <div className="flex items-center gap-3 px-6 py-2 bg-warning/10 border-b border-warning/20">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span className="text-sm text-warning font-medium">
                {t('exams.autoBooking')}
            </span>
            <button
                onClick={onCancel}
                className="btn btn-ghost btn-xs ml-auto"
            >
                {t('common.cancel')}
            </button>
        </div>
    );
}
