import { Bell, Calendar, AlertTriangle, Pin } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { resolveNowNext } from '../../../utils/mobile/nowNext';
import { buildDayAgenda } from '../../../utils/mobile/dayAgenda';
import { ScreenHeader } from './calendar/ScreenHeader';
import { NowNextCard } from './calendar/NowNextCard';
import { DayChips } from './calendar/DayChips';
import { DayAgenda } from './calendar/DayAgenda';
import { MobileBulletinOverlay } from '../../Bulletin/MobileBulletinOverlay';

function toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initials(name: string): string {
    return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatHeaderDate(date: Date, locale: string): string {
    const formatted = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function CalendarSkeleton() {
    return (
        <div data-testid="calendar-skeleton" className="flex flex-1 flex-col gap-3 overflow-hidden p-5">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-base-300" />
            <div className="h-28 animate-pulse rounded-2xl bg-base-300" />
            <div className="h-10 animate-pulse rounded-full bg-base-300" />
            <div className="h-20 animate-pulse rounded-xl bg-base-300" />
            <div className="h-20 animate-pulse rounded-xl bg-base-300" />
        </div>
    );
}

export function CalendarScreen() {
    const { t, language } = useTranslation();
    const locale = language === 'en' ? 'en-US' : 'cs-CZ';
    const { schedule, weekStart } = useSchedule();
    const fullName = useAppStore((s) => s.fullName);
    const mobileSelectedDayIso = useAppStore((s) => s.mobileSelectedDayIso);
    const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
    const setMobileTab = useAppStore((s) => s.setMobileTab);
    const pushSheet = useAppStore((s) => s.pushSheet);
    const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
    const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
    const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);

    const { notifications, readIds } = useNotificationFeed();
    const { alerts } = useDeadlineAlerts();

    const bulletinPosts = useAppStore((s) => s.bulletinPosts);
    const bulletinLoading = useAppStore((s) => s.bulletinLoading);
    const bulletinError = useAppStore((s) => s.bulletinError);
    const bulletinExpanded = useAppStore((s) => s.bulletinExpanded);
    const bulletinHydrated = useAppStore((s) => s.bulletinHydrated);
    const setBulletinExpanded = useAppStore((s) => s.setBulletinExpanded);
    const loadBulletinIfStale = useAppStore((s) => s.loadBulletinIfStale);

    if (!handshakeDone && !handshakeTimedOut) {
        return <CalendarSkeleton />;
    }

    const now = new Date();
    const selectedIso = mobileSelectedDayIso ?? toIso(now);
    const nowNext = resolveNowNext(schedule, now);
    const agenda = buildDayAgenda(schedule, selectedIso);
    const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

    const openBulletin = () => {
        void setBulletinExpanded(true);
        if (bulletinHydrated) void loadBulletinIfStale();
    };

    const openRoute = () => {
        if (!nowNext?.next) return;
        const room = nowNext.next.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
        setMobileTab('map');
        focusRoomByCode(room);
    };

    return (
        <div data-testid="calendar-screen" className="flex flex-1 flex-col overflow-hidden">
            <ScreenHeader
                eyebrow={formatHeaderDate(new Date(`${selectedIso}T00:00:00`), locale)}
                title={t('mobile.calendar.greeting', { name: fullName?.split(' ')[0] ?? '' })}
                action={
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => pushSheet({ kind: 'notifications' })}
                            aria-label={t('mobile.calendar.notifications')}
                            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100"
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-content">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => pushSheet({ kind: 'profile' })}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 font-display text-sm font-bold text-primary"
                        >
                            {fullName ? initials(fullName) : ''}
                        </button>
                    </div>
                }
            />

            {nowNext && <NowNextCard data={nowNext} onRoute={openRoute} />}

            {alerts.length > 0 && (
                <div className="mx-4 mt-3 flex flex-shrink-0 flex-col gap-2">
                    {alerts.slice(0, 3).map((alert) => (
                        <div
                            key={alert.id}
                            className="flex items-center gap-2.5 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2.5"
                        >
                            <AlertTriangle size={16} className="flex-shrink-0 text-warning" />
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate text-xs font-semibold text-content-primary">{alert.title}</span>
                                <span className="truncate text-2xs text-content-secondary">{alert.body}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button
                type="button"
                onClick={openBulletin}
                className="mx-4 mt-3 flex flex-shrink-0 items-center gap-1.5 self-start rounded-lg border border-base-300 bg-base-100/60 px-3 py-1.5"
            >
                <Pin size={14} className="text-primary" />
                <span className="text-xs font-semibold text-content-primary">{t('bulletin.title')}</span>
            </button>
            <MobileBulletinOverlay
                isOpen={bulletinExpanded}
                onClose={() => { void setBulletinExpanded(false); }}
                posts={bulletinPosts}
                loading={bulletinLoading}
                error={bulletinError}
            />

            <DayChips weekStart={weekStart} selectedIso={selectedIso} onSelect={setMobileSelectedDay} />

            <div className="flex-1 overflow-y-auto pb-24">
                {agenda.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Calendar size={28} />
                        </div>
                        <div className="font-display text-base font-bold">{t('mobile.calendar.emptyTitle')}</div>
                        <div className="max-w-56 text-2xs text-content-muted">{t('mobile.calendar.emptyBody')}</div>
                    </div>
                ) : (
                    <DayAgenda
                        rows={agenda}
                        onOpenEvent={(eventId) => pushSheet({ kind: 'eventDetail', eventId })}
                    />
                )}
            </div>
        </div>
    );
}
