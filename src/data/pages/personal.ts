import type { PageCategory } from './types';

export const herna: PageCategory = {
    "id": "herna",
    "label": "Herna pro chvíle oddechu",
    "icon": "Gamepad2",
    "expandable": true,
    "children": [
        {
            "id": "housenka",
            "label": "Housenka",
            "href": "https://is.mendelu.cz/auth/herna/housenka.pl?_m=4154;lang=cz"
        },
        {
            "id": "prehled-her",
            "label": "Přehled her a statistiky",
            "href": "https://is.mendelu.cz/auth/herna/index.pl?_m=4155;lang=cz"
        },
        {
            "id": "iq-soliter",
            "label": "IQ Solitér",
            "href": "https://is.mendelu.cz/auth/herna/soliter.pl?_m=4144;lang=cz"
        },
        {
            "id": "kamenozrout",
            "label": "Kamenožrout",
            "href": "https://is.mendelu.cz/auth/herna/kamenozrout.pl?_m=4152;lang=cz"
        }
    ]
};

export const personalizace: PageCategory = {
    "id": "personalizace",
    "label": "Přizpůsobení informačního systému",
    "icon": "Palette",
    "expandable": true,
    "children": [
        {
            "id": "portlety",
            "label": "Portlety v UIS",
            "href": "https://is.mendelu.cz/auth/personalizace/portlety.pl?_m=354;lang=cz"
        },
        {
            "id": "oblibene",
            "label": "Údržba nabídky Moje oblíbené",
            "href": "https://is.mendelu.cz/auth/personalizace/menu_user.pl?_m=362;lang=cz"
        },
        {
            "id": "office365",
            "label": "Konfigurace přenosu událostí do Office 365",
            "href": "https://is.mendelu.cz/auth/ca/konfigurace_prenosu_udalosti.pl?_m=20781;lang=cz"
        },
        {
            "id": "uziv-nastaveni",
            "label": "Uživatelská nastavení",
            "href": "https://is.mendelu.cz/auth/personalizace/pref.pl?_m=356;lang=cz"
        }
    ]
};

export const nastaveniIS: PageCategory = {
    "id": "nastaveni-is",
    "label": "Nastavení informačního systému",
    "icon": "Cog",
    "expandable": true,
    "children": [
        {
            "id": "totp",
            "label": "Nastavení autentizace pomocí jednorázových hesel (OTP)",
            "href": "https://is.mendelu.cz/auth/system/nastaveni_totp.pl?_m=23141;lang=cz"
        },
        {
            "id": "identita-obcana",
            "label": "Propojení účtu s Identitou občana",
            "href": "https://is.mendelu.cz/auth/system/nia.pl?_m=25361;lang=cz"
        },
        {
            "id": "moje-operace-2",
            "label": "Mé operace",
            "href": "https://is.mendelu.cz/auth/system/zobraz_wlog.pl?current=1;_m=275;lang=cz"
        },
        {
            "id": "zmena-identity",
            "label": "Změna identity",
            "href": "https://is.mendelu.cz/auth/system/zmena_identity.pl?_m=287;lang=cz"
        },
        {
            "id": "delegati",
            "label": "Nastavení delegátů",
            "href": "https://is.mendelu.cz/auth/system/nastaveni_delegatu.pl?_m=288;lang=cz"
        },
        {
            "id": "obnova-hesla",
            "label": "Bezpečnostní údaje pro obnovení hesla",
            "href": "https://is.mendelu.cz/auth/system/hesla_nastaveni.pl?_m=20921;lang=cz"
        },
        {
            "id": "zmena-hesla",
            "label": "Změna hesla",
            "href": "https://is.mendelu.cz/auth/system/zmena_hesla.pl?_m=289;lang=cz"
        },
        {
            "id": "odhlaseni",
            "label": "Odhlášení",
            "href": "https://is.mendelu.cz/auth/system/logout.pl?_m=291;lang=cz"
        }
    ]
};

export const ochranaUdaju: PageCategory = {
    "id": "ochrana-udaju",
    "label": "Ochrana osobních údajů",
    "icon": "Shield",
    "expandable": true,
    "children": [
        {
            "id": "kontrola-udaju",
            "label": "Kontrola osobních údajů",
            "href": "https://is.mendelu.cz/auth/kontrola/?_m=22841;lang=cz"
        },
        {
            "id": "souhlasy",
            "label": "Souhlasy uživatele",
            "href": "https://is.mendelu.cz/auth/system/oou_uziv.pl?_m=22848;lang=cz"
        },
        {
            "id": "statistika-kontroly",
            "label": "Statistika potvrzení o kontrole",
            "href": "https://is.mendelu.cz/auth/kontrola/statistika.pl?_m=22844;lang=cz"
        }
    ]
};
