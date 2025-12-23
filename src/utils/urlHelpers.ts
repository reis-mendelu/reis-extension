/**
 * URL parsing utilities.
 * Extracted from calendarUtils.ts.
 */
import { getStudiumSync, getFacultySync } from './userParams';

export function GetIdFromLink(link: string): string | null {
    const match = link.match(/id=(\d+)/);
    return match ? match[1] : null;
}

export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

/**
 * Inject user's studium and facultyId into a page URL.
 * Replaces the placeholder studium/fakulta with the current user's actual IDs.
 */
export function injectUserParams(url: string): string {
    const studium = getStudiumSync();
    const facultyId = getFacultySync();
    
    let processedUrl = url;

    // 1. Inject Studium
    if (studium) {
        processedUrl = processedUrl.replace(/studium=\d+/g, `studium=${studium}`);
    } else {
        processedUrl = processedUrl
            .replace(/studium=\d+[;,&]?/g, '')
            .replace(/[;,&]?studium=\d+/g, '');
    }

    // 2. Inject Faculty ID (fakulta=)
    if (facultyId) {
        processedUrl = processedUrl.replace(/fakulta=\d+/g, `fakulta=${facultyId}`);
    }

    return processedUrl;
}
