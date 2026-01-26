import { Settings, LogOut } from 'lucide-react';
import type { Tutorial } from '../services/tutorials/types';
import { mainItems } from './Menu/MainItems';

export interface MenuItem { id: string; label: string; shortLabel?: string; popupLabel?: string; icon: React.ReactNode; expandable?: boolean; children?: { label: string; id: string; subtitle?: string; icon?: React.ReactNode; href?: string; isFeature?: boolean; isTutorial?: boolean; tutorial?: Tutorial; isSubject?: boolean; courseCode?: string; subjectId?: string; }[]; danger?: boolean; onClick?: () => void; href?: string; isFeature?: boolean; }

export const getMainMenuItems = (sid: string = '', oid: string = ''): MenuItem[] => mainItems(sid, oid);

export const getSettingsMenuItems = (logout: () => void): MenuItem[] => [
    { id: 'nastaveni', label: 'Nastavení', icon: <Settings className="w-5 h-5" /> },
    { id: 'odhlaseni', label: 'Odhlášení', icon: <LogOut className="w-5 h-5" />, danger: true, onClick: logout }
];
