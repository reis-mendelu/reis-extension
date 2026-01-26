import type { PageCategory } from './types';

export const osobniManagement: PageCategory = {
    "id": "osobni-management",
    "label": "Osobní management",
    "icon": "User",
    "expandable": true,
    "children": [
        {
            "id": "dokumentovy-server",
            "label": "Dokumentový server",
            "href": "https://is.mendelu.cz/auth/dok_server/?_m=229;lang=cz"
        },
        {
            "id": "postovni-schranka",
            "label": "Poštovní schránka",
            "href": "https://is.mendelu.cz/auth/posta/slozka.pl?_m=228;lang=cz"
        },
        {
            "id": "diskuzni-fora",
            "label": "Diskuzní fóra",
            "href": "https://is.mendelu.cz/auth/diskuze/?_m=2720;lang=cz"
        },
        {
            "id": "uloziste-dokumentu",
            "label": "Úložiště dokumentů",
            "href": "https://is.mendelu.cz/auth/uloziste/index.pl?rezim=2;_m=16924;lang=cz"
        },
        {
            "id": "odber-novinek",
            "label": "Odběr novinek",
            "href": "https://is.mendelu.cz/auth/posta/novinky.pl?_m=7937;lang=cz"
        },
        {
            "id": "vyveska",
            "label": "Vývěska",
            "href": "https://is.mendelu.cz/auth/vyveska/index.pl?_m=4696;lang=cz"
        },
        {
            "id": "ukoly",
            "label": "Úkoly",
            "href": "https://is.mendelu.cz/auth/todo/?_m=230;lang=cz"
        },
        {
            "id": "knihovna-vypujcky",
            "label": "Výpůjčky ve školní knihovně",
            "href": "https://is.mendelu.cz/auth/pim/knihovna_vypujcky.pl?_m=239;lang=cz"
        }
    ]
};

export const eAgenda: PageCategory = {
    "id": "eagenda",
    "label": "eAgenda",
    "icon": "Briefcase",
    "expandable": true,
    "children": [
        {
            "id": "kontaktni-centrum",
            "label": "Kontaktní centrum",
            "href": "https://is.mendelu.cz/auth/kc/kc.pl?_m=17022;lang=cz"
        },
        {
            "id": "kolejni-administrativa",
            "label": "Kolejní administrativa",
            "href": "https://is.mendelu.cz/auth/uskm/koleje_index.pl?_m=308;lang=cz"
        },
        {
            "id": "zahranicni-cesty",
            "label": "Zahraniční cesty",
            "href": "https://is.mendelu.cz/auth/int/zahranicni_cesty.pl?_m=14094;lang=cz"
        },
        {
            "id": "epruzkumy",
            "label": "ePrůzkumy",
            "href": "https://is.mendelu.cz/auth/vv/epruzkumy/prehled_pruzkumu.pl?_m=2969;lang=cz"
        },
        {
            "id": "portal-volice",
            "label": "Portál voliče",
            "href": "https://is.mendelu.cz/auth/evolby/portal_volice.pl?_m=23942;lang=cz"
        },
        {
            "id": "evidence-tisku",
            "label": "Evidence tisků",
            "href": "https://is.mendelu.cz/auth/tisk/evidence_tisku.pl?_m=26181;lang=cz"
        }
    ]
};
