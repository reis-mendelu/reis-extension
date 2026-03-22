import type { PageCategory } from './types';

export const technologie: PageCategory = {
    "id": "technologie",
    "label": "Technologie a jejich správa",
    "labelEn": "Technology and its administration",
    "icon": "Settings",
    "expandable": true,
    "children": [
        {
            "id": "wifi-certifikat",
            "label": "Certifikát bezdrátové sítě (eduroam)",
            "labelEn": "Certificate of wireless network (eduroam)",
            "href": "https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177;lang={{lang}}"
        },
        {
            "id": "sprava-uctu",
            "label": "Správa účtů",
            "labelEn": "Accounts administration section",
            "href": "https://is.mendelu.cz/auth/ca/ucet.pl?_m=176;lang={{lang}}"
        },
        {
            "id": "pristupovy-system",
            "label": "Přístupový systém",
            "labelEn": "Access control system",
            "href": "https://is.mendelu.cz/auth/ps/?_m=175;lang={{lang}}"
        },
        {
            "id": "pristup-vpn",
            "label": "Přístup do univerzitní sítě",
            "labelEn": "Access to university network",
            "href": "https://is.mendelu.cz/auth/wifi/heslo_vpn_sit.pl?_m=3532;lang={{lang}}"
        },
        {
            "id": "statistiky-wifi",
            "label": "Statistiky bezdrátové a kolejní sítě",
            "labelEn": "Statistics of wireless and dormitory network",
            "href": "https://is.mendelu.cz/auth/wifi/statistika.pl?_m=21201;lang={{lang}}"
        },
        {
            "id": "univ-posta",
            "label": "Doručování univerzitní pošty",
            "labelEn": "University mail delivery",
            "href": "https://is.mendelu.cz/auth/sit/univ_posta.pl?_m=312;lang={{lang}}"
        },
        {
            "id": "prehled-techniky",
            "label": "Přehled evidované techniky",
            "labelEn": "Overview of registered IT equipment",
            "href": "https://is.mendelu.cz/auth/sit/technika_moje.pl?_m=313;lang={{lang}}"
        },
        {
            "id": "ms-imagine",
            "label": "Přihláška do Microsoft Imagine",
            "labelEn": "Application for Microsoft Imagine",
            "href": "https://is.mendelu.cz/auth/student/nastaveni_dreamspark.pl?_m=4003;lang={{lang}}"
        }
    ]
};

export const spravaIS: PageCategory = {
    "id": "sprava-is",
    "label": "Správa informačního systému",
    "labelEn": "Information system administration",
    "icon": "Database",
    "expandable": true,
    "children": [
        {
            "id": "mobilni-aplikace",
            "label": "Správa pověření externích aplikací",
            "labelEn": "Administration of external applications authorizations",
            "href": "https://is.mendelu.cz/auth/system/mobilni_aplikace.pl?_m=24081;lang={{lang}}"
        }
    ]
};

export const dokumentace: PageCategory = {
    "id": "dokumentace",
    "label": "Dokumentace UIS",
    "labelEn": "UIS documentation",
    "icon": "BookOpen",
    "expandable": true,
    "children": [
        {
            "id": "dokumentace-uis",
            "label": "Dokumentace UIS",
            "labelEn": "UIS documentation",
            "href": "https://is.mendelu.cz/auth/dok/help.pl?_m=21421;lang={{lang}}"
        },
        {
            "id": "faq",
            "label": "Často kladené otázky",
            "labelEn": "Frequently asked questions",
            "href": "https://is.mendelu.cz/auth/dok/faq.pl?_m=255;lang={{lang}}"
        },
        {
            "id": "licence",
            "label": "Licenční informace",
            "labelEn": "Licence information",
            "href": "https://is.mendelu.cz/auth/about/?_m=256;lang={{lang}}"
        },
        {
            "id": "statistiky-uis",
            "label": "Statistiky využití UIS",
            "labelEn": "Statistics of using UIS",
            "href": "https://is.mendelu.cz/auth/system/agregat.pl?_m=267;lang={{lang}}"
        },
        {
            "id": "moje-operace",
            "label": "Mé operace",
            "labelEn": "My operations",
            "href": "https://is.mendelu.cz/auth/system/zobraz_wlog.pl?current=1;_m=286;lang={{lang}}"
        },
        {
            "id": "integratori",
            "label": "Systémoví integrátoři",
            "labelEn": "System integrators",
            "href": "https://is.mendelu.cz/auth/dok/integratori.pl?_m=264;lang={{lang}}"
        }
    ]
};
