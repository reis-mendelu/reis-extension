import { Home, User, GraduationCap, Book, LayoutDashboard, FileText, PenTool, FileQuestion, Upload, BookOpen, Wifi, ClipboardList, CalendarCheck } from 'lucide-react';
import type { MenuItem } from '../menuConfig';

export const mainItems = (sid: string, oid: string, t: (key: string) => string): MenuItem[] => [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: <Home className="w-5 h-5" />, href: 'https://is.mendelu.cz/auth/' },
    { id: 'exams', label: t('sidebar.exams'), icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'subjects', label: t('sidebar.subjects'), icon: <Book className="w-5 h-5" />, expandable: true },
    { id: 'portal', label: t('sidebar.student'), icon: <User className="w-5 h-5" />, expandable: true, children: [
        { id: 'portal-studenta', label: t('sidebar.portal'), icon: <LayoutDashboard className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/student/moje_studium.pl?lang=cz' },
        { id: 'list-zaznamnik', label: t('sidebar.teacherList'), icon: <FileText className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/list.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'testy', label: t('sidebar.tests'), icon: <PenTool className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=cz' },
        { id: 'e-index', label: t('sidebar.eIndex'), icon: <Book className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/pruchod_studiem.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'cvicne-testy', label: t('sidebar.practiceTests'), icon: <FileQuestion className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'odevzdavarna', label: t('sidebar.assignments'), icon: <Upload className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'kontrola-planu', label: t('sidebar.planControl'), icon: <ClipboardList className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/studijni/studijni_povinnosti.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'zapisy-predmetu', label: t('sidebar.registrations'), icon: <BookOpen className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/registrace.pl?studium=${sid};obdobi=${oid};lang=cz` }
    ]},
    { id: 'o-studiu', label: t('sidebar.study'), icon: <GraduationCap className="w-5 h-5" />, expandable: true, children: [
        { id: 'studijni-plany-ut', label: t('sidebar.studyPlans'), icon: <BookOpen className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/katalog/plany.pl?fakulta=2;obdobi=${oid};studium=${sid};lang=cz` },
        { id: 'hodnoceni-uspesnosti', label: t('sidebar.successRating'), icon: <Award className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167' },
        { id: 'wifi', label: t('sidebar.wifi'), icon: <Wifi className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177' },
        { id: 'zadosti-formular', label: t('sidebar.contactCenter'), icon: <ClipboardList className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/kc/kc.pl?_m=17022' }
    ]}
];

import { Award } from 'lucide-react';
