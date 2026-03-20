import type { PageCategory } from './types';

export const vedaVyzkum: PageCategory = {
    "id": "veda-vyzkum",
    "label": "Věda a výzkum",
    "icon": "Microscope",
    "expandable": true,
    "children": [
        {
            "id": "parovani-publikaci",
            "label": "Párování publikací",
            "href": "https://is.mendelu.cz/auth/vv/parovani_publikaci.pl?_m=225;lang={{lang}}"
        },
        {
            "id": "zivotopisne-udaje",
            "label": "Životopisné údaje",
            "href": "https://is.mendelu.cz/auth/vv/bio/?_m=219;lang={{lang}}"
        },
        {
            "id": "tvorba-zivotopisu",
            "label": "Tvorba životopisů",
            "href": "https://is.mendelu.cz/auth/vv/bio/zivotopis.pl?_m=721;lang={{lang}}"
        }
    ]
};

export const elearning: PageCategory = {
    "id": "elearning",
    "icon": "Monitor",
    "expandable": true,
    "children": [
        {
            "id": "testy-zkouseni",
            "label": "Testy a zkoušení",
            "href": "https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang={{lang}}"
        },
        {
            "id": "eknihovajna",
            "label": "Elektronické studijní materiály",
            "href": "https://is.mendelu.cz/auth/eknihovna/?_m=206;lang={{lang}}"
        }
    ]
};
