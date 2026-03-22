import { Home, Book, CalendarCheck, LayoutDashboard, ClipboardList, PenTool, User, Pin } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { PinnedPage } from '../../store/slices/createPinnedPagesSlice';
import { injectUserParams } from '../../data/pages/types';
import { pagesData } from '../../data/pages';

const getTranslatedLabel = (id: string, defaultLabel: string, lang: string) => {
    for (const cat of pagesData) {
        const found = cat.children.find(c => c.id === id);
        if (found) {
            if (lang === 'en' && found.labelEn) return found.labelEn;
            return found.label;
        }
    }
    return defaultLabel;
};

export const mainItems = (sid: string, oid: string, t: (key: string) => string, lang: string = 'cz', pinnedPages: PinnedPage[] = []): MenuItem[] => [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: <Home className="w-5 h-5" />, href: `https://is.mendelu.cz/auth/?lang=${lang}` },
    { id: 'exams', label: t('sidebar.exams'), icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'subjects', label: t('sidebar.subjects'), icon: <Book className="w-5 h-5" /> },
    {
        id: 'is',
        label: t('sidebar.is'),
        icon: <User className="w-5 h-5" />,
        expandable: true,
        children: [
            { id: 'portal-studenta', label: t('sidebar.portal'), icon: <LayoutDashboard className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/moje_studium.pl?lang=${lang}` },
            { id: 'zaznamniky', label: t('sidebar.notebooks'), icon: <ClipboardList className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/list.pl?studium=${sid};obdobi=${oid};lang=${lang}` },
            { id: 'testy', label: t('sidebar.tests'), icon: <PenTool className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=${lang}` },
            ...pinnedPages.map(p => ({
                id: p.id,
                label: getTranslatedLabel(p.id, p.label, lang),
                icon: <Pin className="w-4 h-4" />,
                href: injectUserParams(p.href, sid, lang, oid),
                isPinned: true
            })),
        ]
    },
];

