export interface PageItem {
    id: string;
    label: string;
    href: string;
}

export interface PageCategory {
    id: string;
    label: string;
    icon?: string;
    expandable?: boolean;
    children: PageItem[];
}

/**
 * Inject user's studium into a page URL.
 * Replaces the placeholder studium with the current user's actual ID.
 */
export function injectUserParams(url: string, studiumId?: string): string {
    if (!studiumId) {
        // Remove studium param entirely if we don't have one
        return url
            .replace(/studium=\d+[;,&]?/g, '')
            .replace(/[;,&]?studium=\d+/g, '');
    }
    // Replace any existing studium with the user's value
    return url.replace(/studium=\d+/g, `studium=${studiumId}`);
}
