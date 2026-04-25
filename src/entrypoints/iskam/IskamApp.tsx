import { useState, useEffect } from 'react';
import { LayoutDashboard, BadgeInfo, Wallet, CreditCard, User } from 'lucide-react';
import { IskamPanel } from '@/components/IskamPanel';
import { Sidebar } from '@/components/Sidebar';
import { MobileBottomNav } from '@/components/MobileNav/MobileBottomNav';
import { Toaster } from '@/components/ui/sonner';
import { initializeStore } from '@/store/useAppStore';
import type { AppView } from '@/types/app';
import type { MenuItem } from '@/components/menuConfig';
import { useTranslation } from '@/hooks/useTranslation';

export function IskamApp() {
    const [currentView, setCurrentView] = useState<AppView>('iskam-dashboard');
    const { t } = useTranslation();

    useEffect(() => {
        let unsub: (() => void) | undefined;
        initializeStore().then(unsubscribe => {
            unsub = unsubscribe;
        });
        return () => { unsub?.(); };
    }, []);

    const iskamItems: MenuItem[] = [
        { 
            id: 'iskam-dashboard', 
            label: 'ISKAM', 
            icon: <LayoutDashboard className="w-5 h-5" /> 
        },
        { id: 'div-1', type: 'divider', label: '', icon: <div /> },
        { id: 'hdr-1', type: 'header', label: t('sidebar.more'), icon: <div /> },
        { 
            id: 'basic-details', 
            label: t('settings.basicDetails'), 
            shortLabel: 'Info',
            icon: <BadgeInfo className="w-5 h-5" />,
            href: 'https://webiskam.mendelu.cz/InformaceOKlientovi'
        },
        { 
            id: 'accounts', 
            label: t('settings.accounts'), 
            shortLabel: 'Konta',
            icon: <Wallet className="w-5 h-5" />,
            href: 'https://webiskam.mendelu.cz/Konta'
        },
        { 
            id: 'cards', 
            label: t('settings.cards'), 
            shortLabel: 'Karty',
            icon: <CreditCard className="w-5 h-5" />,
            href: 'https://webiskam.mendelu.cz/KartyKlienta'
        }
    ];

    const iskamTabs = [
        { id: 'iskam-dashboard', label: 'ISKAM', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'accounts', label: 'Konta', icon: <Wallet className="w-5 h-5" /> },
        { id: 'cards', label: 'Karty', icon: <CreditCard className="w-5 h-5" /> },
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