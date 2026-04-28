import { useState, useEffect } from 'react';
import { LayoutDashboard, BadgeInfo, Wallet, Building2, BedDouble, CalendarCheck, UtensilsCrossed, User } from 'lucide-react';
import { IskamPanel } from '@/components/IskamPanel/IskamPanel';
import { Sidebar } from '@/components/Sidebar';
import { MobileBottomNav } from '@/components/MobileNav/MobileBottomNav';
import { Toaster } from '@/components/ui/sonner';
import { initializeIskamStore, useIskamStore } from '@/store/iskamStore';
import { IskamMessages } from '@/types/messages';
import { IndexedDBService } from '@/services/storage';
import type { AppView } from '@/types/app';
import type { MenuItem } from '@/components/menuConfig';
import { useTranslation } from '@/hooks/useTranslation';

export function IskamApp() {
    const [currentView, setCurrentView] = useState<AppView>('iskam-dashboard');
    const { t } = useTranslation();

    useEffect(() => {
        let unsub: (() => void) | undefined;

        // 1. Hydrate from IDB first — UI renders cached data before any network request.
        useIskamStore.getState().loadFromCache().then(() => {
            // 2. Signal ready AFTER hydration — content script flushes its queue to us.
            window.parent.postMessage(IskamMessages.iskamReady(), '*');
        });

        // 3. Listen for content script push (ISKAM_SYNC_UPDATE).
        function onMessage(event: MessageEvent) {
            if (event.source !== window.parent) return;
            if (event.data?.type !== 'ISKAM_SYNC_UPDATE') return;
            const { iskamData, isSyncing, error } = event.data.data;
            if (iskamData) {
                IndexedDBService.set('iskam', 'current', iskamData).catch(() => {});
            }
            useIskamStore.getState().receiveSync(iskamData, isSyncing, error);
        }
        window.addEventListener('message', onMessage);

        // 4. Initialize theme + language (NOT IS Mendelu data fetches).
        initializeIskamStore().then(cleanup => { unsub = cleanup; });

        return () => {
            window.removeEventListener('message', onMessage);
            unsub?.();
        };
    }, []);

    const iskamItems: MenuItem[] = [
        {
            id: 'iskam-dashboard',
            label: 'Přehled',
            icon: <LayoutDashboard className="w-5 h-5" />
        },
        {
            id: 'skm',
            label: 'WebISKAM',
            icon: <Building2 className="w-5 h-5" />,
            expandable: true,
            children: [
                { id: 'zakladni-udaje', label: t('settings.basicDetails'), icon: <BadgeInfo className="w-4 h-4" />, href: 'https://webiskam.mendelu.cz/InformaceOKlientovi' },
                { id: 'konta', label: t('settings.accounts'), icon: <Wallet className="w-4 h-4" />, href: 'https://webiskam.mendelu.cz/Konta' },
                { id: 'volne-kapacity', label: t('settings.availableCapacity'), icon: <BedDouble className="w-4 h-4" />, href: 'https://webiskam.mendelu.cz/VolneKapacity' },
                { id: 'prehled-ubytovani', label: t('settings.housingOverview'), icon: <Building2 className="w-4 h-4" />, href: 'https://webiskam.mendelu.cz/PrehledUbytovani' },
                { id: 'rezervace', label: t('settings.reservations'), icon: <CalendarCheck className="w-4 h-4" />, href: 'https://webiskam.mendelu.cz/Rezervace' },
                { id: 'inkaso-stravu', label: t('settings.foodDebit'), icon: <UtensilsCrossed className="w-4 h-4" />, href: 'https://webiskam.mendelu.cz/KrSystem' },
            ]
        },
    ];

    const iskamTabs = [
        { id: 'iskam-dashboard', label: 'Přehled', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'accounts', label: 'Konta', icon: <Wallet className="w-5 h-5" /> },
        { id: 'skm', label: 'WebISKAM', icon: <Building2 className="w-5 h-5" /> },
        { id: 'profile', label: 'Profil', icon: <User className="w-5 h-5" /> },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-base-200 font-sans text-base-content">
            <Toaster position="top-center" />
            <Sidebar
                currentView={currentView}
                onViewChange={setCurrentView}
                items={iskamItems}
                isIskam={true}
            />

            <MobileBottomNav
                currentView={currentView}
                onViewChange={setCurrentView}
                items={iskamItems}
                tabs={iskamTabs}
                isIskam={true}
            />

            <main className="flex-1 flex flex-col transition-all duration-300 overflow-hidden">
                <div className="flex-1 pt-3 px-4 pb-1 touch:pb-16 overflow-hidden flex flex-col">
                    <div className="flex-1 bg-base-100 rounded-lg touch:rounded-t-lg touch:rounded-b-none shadow-sm border border-base-300 overflow-y-auto">
                        <div className="max-w-2xl mx-auto py-4">
                            <IskamPanel />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
