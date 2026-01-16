/**
 * Calendar Click Hint Component
 * 
 * Shows a first-use hint for clicking on calendar events.
 * Uses the same pattern as DragHint in SubjectFileDrawer.
 * 
 * Positions dynamically based on first event location.
 */

import { MousePointerClick } from 'lucide-react';

interface CalendarHintProps {
    show: boolean;
    /** Position of the first event for dynamic hint placement */
    firstEventPosition?: { top: number; left: number; width: number };
}

export function CalendarHint({ show, firstEventPosition }: CalendarHintProps) {
    if (!show) return null;

    // Default fallback position (first column, ~9am = 15% from top)
    const position = firstEventPosition || { top: 15, left: 10, width: 20 };
    
    // Position cursor at center-top of the first event (using percentages)
    const cursorTop = `calc(${position.top}% + 10px)`;
    const cursorLeft = `calc(${position.left}% + ${position.width / 2}% - 20px)`; // 20px = half cursor width
    
    // Position tooltip below the cursor
    const tooltipTop = `calc(${position.top}% + 70px)`;
    
    // Calculate horizontal alignment based on column position relative to grid
    // Left edge (Mon): Align left
    // Right edge (Fri): Align right
    // Middle: Center
    const isLeftEdge = position.left < 5;
    const isRightEdge = position.left > 80;

    let tooltipLeft = `calc(${position.left}% + ${position.width / 2}%)`;
    let tooltipTransform = 'translateX(-50%)';

    if (isLeftEdge) {
        tooltipLeft = `calc(${position.left}% + 16px)`;
        tooltipTransform = 'none';
    } else if (isRightEdge) {
        tooltipLeft = `calc(${position.left}% + ${position.width}% - 16px)`;
        tooltipTransform = 'translateX(-100%)';
    }

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {/* Animated click indicator */}
            <div 
                className="absolute"
                style={{
                    animation: 'calendarHintPulse 2s ease-in-out infinite',
                    top: cursorTop,
                    left: cursorLeft,
                }}
            >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <MousePointerClick size={20} className="text-primary" />
                </div>
            </div>

            {/* Tooltip Wrapper - Handles positioning */}
            <div 
                className="absolute"
                style={{
                    top: tooltipTop,
                    left: tooltipLeft,
                    transform: tooltipTransform,
                }}
            >
                {/* Tooltip Content - Handles animation */}
                <div 
                    className="bg-neutral text-neutral-content text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 whitespace-nowrap"
                    style={{
                        animation: 'calendarHintFade 4s ease-in-out forwards',
                    }}
                >
                    <MousePointerClick size={16} className="text-primary flex-shrink-0" />
                    <span>Klikněte na předmět pro zobrazení materiálů</span>
                </div>
            </div>

            <style>{`
                @keyframes calendarHintPulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.2); opacity: 1; }
                }
                @keyframes calendarHintFade {
                    0% { opacity: 0; transform: translateY(10px); }
                    15% { opacity: 1; transform: translateY(0); }
                    85% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `}</style>
        </div>
    );
}
