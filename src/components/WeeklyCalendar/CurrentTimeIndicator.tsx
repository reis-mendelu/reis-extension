import { useState, useEffect } from 'react';
import { timeToPercent } from './utils';

interface CurrentTimeIndicatorProps {
    todayIndex: number;
}

export function CurrentTimeIndicator({ todayIndex }: CurrentTimeIndicatorProps) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const ms = (60 - now.getSeconds()) * 1000;
        const timeout = setTimeout(() => {
            setNow(new Date());
            const interval = setInterval(() => setNow(new Date()), 60_000);
            return () => clearInterval(interval);
        }, ms);
        return () => clearTimeout(timeout);
    }, []);

    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (todayIndex < 0 || todayIndex > 4 || hours < 7 || hours >= 21) return null;

    const top = timeToPercent(`${hours}:${minutes}`);
    const columnWidth = 100 / 5;
    const left = todayIndex * columnWidth;

    return (
        <div
            className="absolute z-10 pointer-events-none"
            style={{ top: `${top}%`, left: `${left}%`, width: `${columnWidth}%` }}
        >
            <div className="relative flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-error -ml-[5px] shrink-0" />
                <div className="flex-1 h-[2px] bg-error" />
            </div>
        </div>
    );
}
