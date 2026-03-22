import type { PageCategory } from './types';

export const osobniManagement: PageCategory = {
    "id": "osobni-management",
    "label": "Osobní management",
    "labelEn": "Personal management",
    "icon": "Calendar",
    "expandable": true,
    "children": [
        {
            "id": "dokumentovy-server",
            "label": "Dokumentový server",
            "labelEn": "Document server",
            "href": "https://is.mendelu.cz/auth/dok_server/?_m=229;lang={{lang}}"
        },
        {
            "id": "postovni-schranka",
            "label": "Poštovní schránka",
            "labelEn": "Mail box",
            "href": "https://is.mendelu.cz/auth/posta/slozka.pl?_m=228;lang={{lang}}"
        },
        {
            "id": "diskuzni-fora",
            "label": "Diskuzní fóra",
            "labelEn": "Discussion platforms",
            "href": "https://is.mendelu.cz/auth/diskuze/?_m=2720;lang={{lang}}"
        },
        {
            "id": "uloziste-dokumentu",
            "label": "Úložiště dokumentů",
            "labelEn": "Document storage",
            "href": "https://is.mendelu.cz/auth/uloziste/index.pl?rezim=2;_m=16924;lang={{lang}}"
        },
        {
            "id": "odber-novinek",
            "label": "Odběr novinek",
            "labelEn": "Sign up for news",
            "href": "https://is.mendelu.cz/auth/posta/novinky.pl?_m=7937;lang={{lang}}"
        },
        {
            "id": "vyveska",
            "label": "Vývěska",
            "labelEn": "Noticeboard",
            "href": "https://is.mendelu.cz/auth/vyveska/index.pl?_m=4696;lang={{lang}}"
        },
        {
            "id": "ukoly",
            "label": "Úkoly",
            "labelEn": "Tasks",
            "href": "https://is.mendelu.cz/auth/todo/?_m=230;lang={{lang}}"
        },
        {
            "id": "knihovna-vypujcky",
            "label": "Výpůjčky ve školní knihovně",
            "labelEn": "Borrowings from the university library",
            "href": "https://is.mendelu.cz/auth/pim/knihovna_vypujcky.pl?_m=239;lang={{lang}}"
        }
    ]
};

export const eAgenda: PageCategory = {
    "id": "e-agenda",
    "label": "Elektronická agenda",
    "labelEn": "eAgenda",
    "icon": "FileText",
    "expandable": true,
    "children": [
        {
            "id": "kontaktni-centrum",
            "label": "Kontaktní centrum",
            "labelEn": "Contact centre",
            "href": "https://is.mendelu.cz/auth/kc/kc.pl?_m=17022;lang={{lang}}"
        },
        {
            "id": "kolejni-administrativa",
            "label": "Kolejní administrativa",
            "labelEn": "Dormitory administration",
            "href": "https://is.mendelu.cz/auth/uskm/koleje_index.pl?_m=308;lang={{lang}}"
        },
        {
            "id": "zahranicni-cesty",
            "label": "Zahraniční cesty",
            "labelEn": "Trips abroad",
            "href": "https://is.mendelu.cz/auth/int/zahranicni_cesty.pl?_m=14094;lang={{lang}}"
        },
        {
            "id": "epruzkumy",
            "label": "ePrůzkumy",
            "labelEn": "eSurveys",
            "href": "https://is.mendelu.cz/auth/vv/epruzkumy/prehled_pruzkumu.pl?_m=2969;lang={{lang}}"
        },
        {
            "id": "portal-volice",
            "label": "Portál voliče",
            "labelEn": "My Elections",
            "href": "https://is.mendelu.cz/auth/evolby/portal_volice.pl?_m=23942;lang={{lang}}"
        },
        {
            "id": "evidence-tisku",
            "label": "Evidence tisků",
            "labelEn": "Register of printouts",
            "href": "https://is.mendelu.cz/auth/tisk/evidence_tisku.pl?_m=26181;lang={{lang}}"
        }
    ]
};
