import { Settings, LogOut } from 'lucide-react';
import { mainItems } from './Menu/MainItems';
import type { PinnedPage } from '../store/slices/createPinnedPagesSlice';
import type { PageCategory } from '../data/pages/types';

export interface MenuItem { 
    id: string; 
    label: string; 
    shortLabel?: string; 
    popupLabel?: string; 
    icon: React.ReactNode; 
    badge?: number; 
    expandable?: boolean; 
    children?: { 
        label: string; 
        id: string; 
        subtitle?: string; 
        icon?: React.ReactNode; 
        href?: string; 
        isFeature?: boolean; 
        isSubject?: boolean; 
        courseCode?: string; 
        subjectId?: string; 
        isPinned?: boolean; 
    }[]; 
    danger?: boolean; 
    onClick?: () => void; 
    href?: string; 
    isFeature?: boolean;
    type?: 'item' | 'header' | 'divider';
}

export const getMainMenuItems = (sid: string = '', oid: string = '', t: (key: string) => string, lang: string = 'cz', pinnedPages: PinnedPage[] = [], navPages?: PageCategory[] | null): MenuItem[] => mainItems(sid, oid, t, lang, pinnedPages, navPages);

export const getSettingsMenuItems = (logout: () => void): MenuItem[] => [
    { id: 'nastaveni', label: 'Nastavení', icon: <Settings className="w-5 h-5" /> },
    { id: 'odhlaseni', label: 'Odhlášení', icon: <LogOut className="w-5 h-5" />, danger: true, onClick: logout }
];