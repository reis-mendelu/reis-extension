export interface PageItem {
    id: string;
    label: string;
    labelEn?: string;
    href: string;
}

export interface PageCategory {
    id: string;
    label: string;
    labelEn?: string;
    icon?: string;
    expandable?: boolean;
    children: PageItem[];
}



/**
 * Inject user's params into a page URL.
 * Replaces placeholders or hardcoded IDs with current values.
 */
export function injectUserParams(url: string, studiumId?: string, lang: string = 'cz', obdobiId?: string, facultyId?: string): string {
    let resolved = url;

    // Handle studium
    if (studiumId) {
        resolved = resolved
            .replace(/{{studium}}/g, studiumId)
            .replace(/studium=\d+/g, `studium=${studiumId}`);
    } else {
        resolved = resolved
            .replace(/studium={{studium}}[;,&]?/g, '')
            .replace(/[;,&]?studium={{studium}}/g, '')
            .replace(/studium=\d+[;,&]?/g, '')
            .replace(/[;,&]?studium=\d+/g, '');
    }

    // Handle faculty
    if (facultyId) {
        resolved = resolved
            .replace(/{{faculty}}/g, facultyId)
            .replace(/fakulta=\d+/g, `fakulta=${facultyId}`);
    }

    // Handle obdobi
    if (obdobiId) {
        resolved = resolved
            .replace(/{{obdobi}}/g, obdobiId)
            .replace(/obdobi=\d+/g, `obdobi=${obdobiId}`);
    }

    // Handle lang
    resolved = resolved
        .replace(/{{lang}}/g, lang)
        .replace(/lang=[a-z]{2}/g, `lang=${lang}`);

    return resolved;
}

