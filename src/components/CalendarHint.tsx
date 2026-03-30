/**
 * Calendar Discovery Hotspot
 * 
 * A pulsing dot that guides users to interactive calendar events.
 * Stays visible until dismissed by interaction.
 */

import { useTranslation } from '../hooks/useTranslation';

interface CalendarHintProps {
    show: boolean;
    /** Position of the targeted event */
    eventPosition?: { top: number; left: number; width: number };
    /** Callback to dismiss hint */
    onDismiss?: () => void;
}

export function CalendarHint({ show, eventPosition, onDismiss }: CalendarHintProps) {
    const { t } = useTranslation();
    
    if (!show || !eventPosition) return null;

    // Position hotspot at the top-right corner of the event
    const top = `${eventPosition.top}%`;
    const left = `calc(${eventPosition.left}% + ${eventPosition.width}% - 12px)`;
    
    return (
        <div 
            className="absolute z-10 pointer-events-none"
            style={{ top, left }}
        >
            <div 
                className="relative group pointer-events-auto cursor-help"
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss?.();
                }}
            >
                {/* Core Pulse */}
                <div className="w-3 h-3 bg-primary rounded-full shadow-lg border-2 border-base-100 relative z-10" />
                
                {/* Outer Ping Animation */}
                <div className="absolute inset-0 w-3 h-3 bg-primary rounded-full animate-ping opacity-75" />

                {/* Discovery Tooltip - Appears on hover */}
                <div className="absolute left-1/2 -bottom-2 translate-y-full -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap">
                    <div className="bg-neutral text-neutral-content text-[11px] font-bold px-2 py-1 rounded shadow-xl flex items-center gap-1.5 border border-base-content/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        {t('course.clickHint')}
                    </div>
                </div>
            </div>
        </div>
    );
}
