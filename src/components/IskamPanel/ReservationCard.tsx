import { CalendarRange } from 'lucide-react';
import type { IskamReservation } from '../../types/iskam';

interface ReservationCardProps {
    reservation: IskamReservation;
    dimmed?: boolean;
}

export function ReservationCard({ reservation, dimmed }: ReservationCardProps) {
    return (
        <div className={`card bg-base-100 shadow-sm border border-base-200 ${dimmed ? 'opacity-60' : ''}`}>
            <div className="card-body p-4 gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <CalendarRange size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-base-content truncate">{reservation.facility}</span>
                        <span className="text-xs text-base-content/60">{reservation.room}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-base-content/60 mt-1">
                    <span>{reservation.startDate} – {reservation.endDate}</span>
                    {reservation.price && <span className="font-medium text-base-content/80">{reservation.price}</span>}
                </div>
            </div>
        </div>
    );
}
