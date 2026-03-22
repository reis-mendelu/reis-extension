import type { PageCategory } from './types';

export const vedaVyzkum: PageCategory = {
    "id": "veda-vyzkum",
    "label": "Věda a výzkum",
    "labelEn": "Science and research",
    "icon": "Microscope",
    "expandable": true,
    "children": [
        {
            "id": "parovani-publikaci",
            "label": "Párování publikací",
            "labelEn": "Matching of publications",
            "href": "https://is.mendelu.cz/auth/vv/parovani_publikaci.pl?_m=225;lang={{lang}}"
        },
        {
            "id": "zivotopisne-udaje",
            "label": "Životopisné údaje",
            "labelEn": "Biographical information",
            "href": "https://is.mendelu.cz/auth/vv/bio/?_m=219;lang={{lang}}"
        },
        {
            "id": "tvorba-zivotopisu",
            "label": "Tvorba životopisů",
            "labelEn": "Creation of CVs",
            "href": "https://is.mendelu.cz/auth/vv/bio/zivotopis.pl?_m=721;lang={{lang}}"
        }
    ]
};

export const elearning: PageCategory = {
    "id": "elearning",
    "label": "E-learning",
    "labelEn": "eLearning",
    "icon": "Monitor",
    "expandable": true,
    "children": [
        {
            "id": "testy-zkouseni",
            "label": "Testy a zkoušení",
            "labelEn": "Tests and examinations",
            "href": "https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang={{lang}}"
        },
        {
            "id": "eknihovajna",
            "label": "Elektronické studijní materiály",
            "labelEn": "Electronic study materials",
            "href": "https://is.mendelu.cz/auth/eknihovna/?_m=206;lang={{lang}}"
        }
    ]
};

