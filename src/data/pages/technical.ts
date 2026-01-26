import type { PageCategory } from './types';

export const technologie: PageCategory = {
    "id": "technologie",
    "label": "Technologie a jejich správa",
    "icon": "Settings",
    "expandable": true,
    "children": [
        {
            "id": "wifi-certifikat",
            "label": "Certifikát bezdrátové sítě (eduroam)",
            "href": "https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177;lang=cz"
        },
        {
            "id": "sprava-uctu",
            "label": "Správa účtů",
            "href": "https://is.mendelu.cz/auth/ca/ucet.pl?_m=176;lang=cz"
        },
        {
            "id": "pristupovy-system",
            "label": "Přístupový systém",
            "href": "https://is.mendelu.cz/auth/ps/?_m=175;lang=cz"
        },
        {
            "id": "pristup-vpn",
            "label": "Přístup do univerzitní sítě",
            "href": "https://is.mendelu.cz/auth/wifi/heslo_vpn_sit.pl?_m=3532;lang=cz"
        },
        {
            "id": "statistiky-wifi",
            "label": "Statistiky bezdrátové a kolejní sítě",
            "href": "https://is.mendelu.cz/auth/wifi/statistika.pl?_m=21201;lang=cz"
        },
        {
            "id": "univ-posta",
            "label": "Doručování univerzitní pošty",
            "href": "https://is.mendelu.cz/auth/sit/univ_posta.pl?_m=312;lang=cz"
        },
        {
            "id": "prehled-techniky",
            "label": "Přehled evidované techniky",
            "href": "https://is.mendelu.cz/auth/sit/technika_moje.pl?_m=313;lang=cz"
        },
        {
            "id": "ms-imagine",
            "label": "Přihláška do Microsoft Imagine",
            "href": "https://is.mendelu.cz/auth/student/nastaveni_dreamspark.pl?_m=4003;lang=cz"
        }
    ]
};

export const spravaIS: PageCategory = {
    "id": "sprava-is",
    "label": "Správa informačního systému",
    "icon": "Database",
    "expandable": true,
    "children": [
        {
            "id": "mobilni-aplikace",
            "label": "Správa pověření externích aplikací",
            "href": "https://is.mendelu.cz/auth/system/mobilni_aplikace.pl?_m=24081;lang=cz"
        }
    ]
};

export const dokumentace: PageCategory = {
    "id": "dokumentace",
    "label": "Dokumentace UIS",
    "icon": "BookOpen",
    "expandable": true,
    "children": [
        {
            "id": "dokumentace-uis",
            "label": "Dokumentace UIS",
            "href": "https://is.mendelu.cz/auth/dok/help.pl?_m=21421;lang=cz"
        },
        {
            "id": "faq",
            "label": "Často kladené otázky",
            "href": "https://is.mendelu.cz/auth/dok/faq.pl?_m=255;lang=cz"
        },
        {
            "id": "licence",
            "label": "Licenční informace",
            "href": "https://is.mendelu.cz/auth/about/?_m=256;lang=cz"
        },
        {
            "id": "statistiky-uis",
            "label": "Statistiky využití UIS",
            "href": "https://is.mendelu.cz/auth/system/agregat.pl?_m=267;lang=cz"
        },
        {
            "id": "moje-operace",
            "label": "Mé operace",
            "href": "https://is.mendelu.cz/auth/system/zobraz_wlog.pl?current=1;_m=286;lang=cz"
        },
        {
            "id": "integratori",
            "label": "Systémoví integrátoři",
            "href": "https://is.mendelu.cz/auth/dok/integratori.pl?_m=264;lang=cz"
        }
    ]
};
