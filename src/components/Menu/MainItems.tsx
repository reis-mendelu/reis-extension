import { Home, User, GraduationCap, Book, LayoutDashboard, FileText, PenTool, FileQuestion, Upload, BookOpen, Wifi, ClipboardList, CalendarCheck } from 'lucide-react';
import type { MenuItem } from '../menuConfig';

export const mainItems = (sid: string, oid: string): MenuItem[] => [
    { id: 'dashboard', label: 'Domů', icon: <Home className="w-5 h-5" />, href: 'https://is.mendelu.cz/auth/' },
    { id: 'exams', label: 'Zkoušky', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'subjects', label: 'Předměty', icon: <Book className="w-5 h-5" />, expandable: true },
    { id: 'portal', label: 'Student', icon: <User className="w-5 h-5" />, expandable: true, children: [
        { id: 'portal-studenta', label: 'Portál studenta', icon: <LayoutDashboard className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/student/moje_studium.pl?lang=cz' },
        { id: 'list-zaznamnik', label: 'List záznamníku učitele', icon: <FileText className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/list.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'testy', label: 'Testy', icon: <PenTool className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=cz' },
        { id: 'e-index', label: 'E-index', icon: <Book className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/pruchod_studiem.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'cvicne-testy', label: 'Cvičné testy', icon: <FileQuestion className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'odevzdavarna', label: 'Odevzdávárna', icon: <Upload className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=${sid};obdobi=${oid};lang=cz` },
        { id: 'zapisy-predmetu', label: 'Zápisy předmětů', icon: <BookOpen className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/registrace.pl?studium=${sid};obdobi=${oid};lang=cz` }
    ]},
    { id: 'o-studiu', label: 'Studium', icon: <GraduationCap className="w-5 h-5" />, expandable: true, children: [
        { id: 'studijni-plany-ut', label: 'Přehled studijních plánů', icon: <BookOpen className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/katalog/plany.pl?fakulta=2;obdobi=${oid};studium=${sid};lang=cz` },
        { id: 'hodnoceni-uspesnosti', label: 'Hodnocení úspěšnosti', icon: <Award className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167' },
        { id: 'wifi', label: 'Wi-Fi', icon: <Wifi className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177' },
        { id: 'zadosti-formular', label: 'Kontaktní centrum', icon: <ClipboardList className="w-4 h-4" />, href: 'https://is.mendelu.cz/auth/kc/kc.pl?_m=17022' }
    ]}
];

import { Award } from 'lucide-react';
