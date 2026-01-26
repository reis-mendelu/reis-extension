import type { PageCategory } from './types';

export const portalInfo: PageCategory = {
    "id": "portal-info",
    "label": "Portál veřejných informací",
    "icon": "Info",
    "expandable": true,
    "children": [
        {
            "id": "katalog-predmetu",
            "label": "Katalog předmětů",
            "href": "https://is.mendelu.cz/auth/katalog/?_m=111;lang=cz"
        },
        {
            "id": "lide",
            "label": "Lidé na MENDELU",
            "href": "https://is.mendelu.cz/auth/lide/?_m=104;lang=cz"
        },
        {
            "id": "rozvrhy",
            "label": "Rozvrhy",
            "href": "https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl?_m=117;lang=cz"
        },
        {
            "id": "dalsi-info",
            "label": "Další informace o MENDELU",
            "href": "https://is.mendelu.cz/auth/verejne_informace.pl?_m=8301;lang=cz"
        },
        {
            "id": "tematicke-vyhledavani",
            "label": "Tematické vyhledávání",
            "href": "https://is.mendelu.cz/auth/hledani/?_m=8311;lang=cz"
        },
        {
            "id": "studijni-plany",
            "label": "Studijní plány",
            "href": "https://is.mendelu.cz/auth/katalog/plany.pl?_m=113;lang=cz"
        },
        {
            "id": "pracoviste",
            "label": "Pracoviště",
            "href": "https://is.mendelu.cz/auth/pracoviste/pracoviste.pl?_m=8312;lang=cz"
        },
        {
            "id": "zaverecne-prace",
            "label": "Závěrečné práce na MENDELU",
            "href": "https://is.mendelu.cz/auth/zp/?_m=20841;lang=cz"
        },
        {
            "id": "absolventi",
            "label": "Absolventi",
            "href": "https://is.mendelu.cz/auth/lide/absolventi.pl?_m=23002;lang=cz"
        }
    ]
};
