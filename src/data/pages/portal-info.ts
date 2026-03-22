import type { PageCategory } from './types';

export const portalInfo: PageCategory = {
    "id": "portal-info",
    "label": "Portál veřejných informací",
    "labelEn": "Public information portal",
    "icon": "Info",
    "expandable": true,
    "children": [
        {
            "id": "katalog-predmetu",
            "label": "Katalog předmětů",
            "labelEn": "Course catalogue",
            "href": "https://is.mendelu.cz/auth/katalog/?_m=111;lang={{lang}}"
        },
        {
            "id": "lide",
            "label": "Lidé na MENDELU",
            "labelEn": "Persons at MENDELU",
            "href": "https://is.mendelu.cz/auth/lide/?_m=104;lang={{lang}}"
        },
        {
            "id": "rozvrhy",
            "label": "Rozvrhy",
            "labelEn": "Timetables",
            "href": "https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl?_m=117;lang={{lang}}"
        },

        {
            "id": "dalsi-info",
            "label": "Další informace o MENDELU",
            "labelEn": "Further information about MENDELU",
            "href": "https://is.mendelu.cz/auth/verejne_informace.pl?_m=8301;lang={{lang}}"
        },
        {
            "id": "tematicke-vyhledavani",
            "label": "Tematické vyhledávání",
            "labelEn": "Thematic search",
            "href": "https://is.mendelu.cz/auth/hledani/?_m=8311;lang={{lang}}"
        },
        {
            "id": "studijni-plany",
            "label": "Studijní plány",
            "labelEn": "Study plans",
            "href": "https://is.mendelu.cz/auth/katalog/plany.pl?_m=113;lang={{lang}}"
        },
        {
            "id": "pracoviste",
            "label": "Pracoviště",
            "labelEn": "Departments",
            "href": "https://is.mendelu.cz/auth/pracoviste/pracoviste.pl?_m=8312;lang={{lang}}"
        },
        {
            "id": "zaverecne-prace",
            "label": "Závěrečné práce na MENDELU",
            "labelEn": "Final theses at MENDELU",
            "href": "https://is.mendelu.cz/auth/zp/?_m=20841;lang={{lang}}"
        },
        {
            "id": "absolventi",
            "label": "Absolventi",
            "labelEn": "Graduates",
            "href": "https://is.mendelu.cz/auth/lide/absolventi.pl?_m=23002;lang={{lang}}"
        }
    ]
};
