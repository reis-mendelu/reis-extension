import type { PageCategory } from './types';

export const herna: PageCategory = {
    "id": "herna",
    "label": "Herna pro chvíle oddechu",
    "labelEn": "Game room",
    "icon": "Gamepad2",
    "expandable": true,
    "children": [
        {
            "id": "housenka",
            "label": "Housenka",
            "labelEn": "Caterpillar",
            "href": "https://is.mendelu.cz/auth/herna/housenka.pl?_m=4154;lang={{lang}}"
        },
        {
            "id": "prehled-her",
            "label": "Přehled her a statistiky",
            "labelEn": "List of games and statistics",
            "href": "https://is.mendelu.cz/auth/herna/index.pl?_m=4155;lang={{lang}}"
        },
        {
            "id": "iq-soliter",
            "label": "IQ Solitér",
            "labelEn": "IQ Solitaire",
            "href": "https://is.mendelu.cz/auth/herna/soliter.pl?_m=4144;lang={{lang}}"
        },
        {
            "id": "kamenozrout",
            "label": "Kamenožrout",
            "labelEn": "Stone Eater",
            "href": "https://is.mendelu.cz/auth/herna/kamenozrout.pl?_m=4152;lang={{lang}}"
        }
    ]
};

export const personalizace: PageCategory = {
    "id": "personalizace",
    "label": "Přizpůsobení informačního systému",
    "labelEn": "Adjustment of the information system",
    "icon": "Palette",
    "expandable": true,
    "children": [
        {
            "id": "portlety",
            "label": "Portlety v UIS",
            "labelEn": "Portlets in UIS",
            "href": "https://is.mendelu.cz/auth/personalizace/portlety.pl?_m=354;lang={{lang}}"
        },
        {
            "id": "oblibene",
            "label": "Údržba nabídky Moje oblíbené",
            "labelEn": "Administration of My favourites menu",
            "href": "https://is.mendelu.cz/auth/personalizace/menu_user.pl?_m=362;lang={{lang}}"
        },
        {
            "id": "office365",
            "label": "Konfigurace přenosu událostí do Office 365",
            "labelEn": "Configure transfer of events to Office 365",
            "href": "https://is.mendelu.cz/auth/ca/konfigurace_prenosu_udalosti.pl?_m=20781;lang={{lang}}"
        },
        {
            "id": "uziv-nastaveni",
            "label": "Uživatelská nastavení",
            "labelEn": "User settings",
            "href": "https://is.mendelu.cz/auth/personalizace/pref.pl?_m=356;lang={{lang}}"
        }
    ]
};

export const nastaveniIS: PageCategory = {
    "id": "nastaveni-is",
    "label": "Nastavení informačního systému",
    "labelEn": "Information system set-up",
    "icon": "Cog",
    "expandable": true,
    "children": [
        {
            "id": "totp",
            "label": "Nastavení autentizace pomocí jednorázových hesel (OTP)",
            "labelEn": "Setting of authentication using one-time passwords (OTP)",
            "href": "https://is.mendelu.cz/auth/system/nastaveni_totp.pl?_m=23141;lang={{lang}}"
        },
        {
            "id": "identita-obcana",
            "label": "Propojení účtu s Identitou občana",
            "labelEn": "Link your account to eID",
            "href": "https://is.mendelu.cz/auth/system/nia.pl?_m=25361;lang={{lang}}"
        },
        {
            "id": "moje-operace-2",
            "label": "Mé operace",
            "labelEn": "My operations",
            "href": "https://is.mendelu.cz/auth/system/zobraz_wlog.pl?current=1;_m=275;lang={{lang}}"
        },
        {
            "id": "zmena-identity",
            "label": "Změna identity",
            "labelEn": "Change identity",
            "href": "https://is.mendelu.cz/auth/system/zmena_identity.pl?_m=287;lang={{lang}}"
        },
        {
            "id": "delegati",
            "label": "Nastavení delegátů",
            "labelEn": "Configuration of deputies",
            "href": "https://is.mendelu.cz/auth/system/nastaveni_delegatu.pl?_m=288;lang={{lang}}"
        },
        {
            "id": "obnova-hesla",
            "label": "Bezpečnostní údaje pro obnovení hesla",
            "labelEn": "Security details for password recovery",
            "href": "https://is.mendelu.cz/auth/system/hesla_nastaveni.pl?_m=20921;lang={{lang}}"
        },
        {
            "id": "zmena-hesla",
            "label": "Změna hesla",
            "labelEn": "Password change",
            "href": "https://is.mendelu.cz/auth/system/zmena_hesla.pl?_m=289;lang={{lang}}"
        }
    ]
};

export const ochranaUdaju: PageCategory = {
    "id": "ochrana-udaju",
    "label": "Ochrana osobních údajů",
    "labelEn": "Protection of personal data",
    "icon": "Shield",
    "expandable": true,
    "children": [
        {
            "id": "kontrola-udaju",
            "label": "Kontrola osobních údajů",
            "labelEn": "Personal data check",
            "href": "https://is.mendelu.cz/auth/kontrola/?_m=22841;lang={{lang}}"
        },
        {
            "id": "souhlasy",
            "label": "Souhlasy uživatele",
            "labelEn": "Approvals by user",
            "href": "https://is.mendelu.cz/auth/system/oou_uziv.pl?_m=22848;lang={{lang}}"
        },
        {
            "id": "statistika-kontroly",
            "label": "Statistika potvrzení o kontrole",
            "labelEn": "Personal data check statistics",
            "href": "https://is.mendelu.cz/auth/kontrola/statistika.pl?_m=22844;lang={{lang}}"
        }
    ]
};

