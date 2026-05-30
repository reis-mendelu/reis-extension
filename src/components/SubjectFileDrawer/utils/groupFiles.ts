import type { ParsedFile } from '../../../types/documents';
import { cleanFolderName } from '../../../utils/fileUrl';
import type { FileGroup } from '../types';

/**
 * Groups a list of parsed files by subfolder and sorts them by date and name.
 */
export function groupAndSortFiles(
    files: ParsedFile[] | null,
    courseCode: string | undefined,
    t: (key: string) => string
): FileGroup[] {
    if (!files) return [];
    
    const otherFolder = t('course.footer.other') || 'Other';
    const knownFolderKeys: Record<string, string> = {
        'informace k výuce': 'fileCategories.informace_k_vyuce',
        'studijní texty': 'fileCategories.studijni_texty',
        'materiály z přednášek': 'fileCategories.materialy_z_prednasek',
        'průvodce studiem předmětu': 'fileCategories.pruvodce_studiem',
    };
    
    const translateFolder = (name: string) => {
        const i18nKey = knownFolderKeys[name.toLowerCase()];
        return i18nKey ? (t(i18nKey) || name) : name;
    };
    
    const groups = new Map<string, ParsedFile[]>();
    files.forEach(f => {
        const sub = f.subfolder?.trim() || otherFolder;
        if (!groups.has(sub)) groups.set(sub, []);
        groups.get(sub)?.push(f);
    });
    
    return Array.from(groups.keys())
        .map(key => ({
            name: key,
            displayName: key === otherFolder ? otherFolder : translateFolder(cleanFolderName(key, courseCode)),
            files: groups.get(key)!.sort((a, b) => {
                const parseDate = (d: string) => { 
                    const [day, mon, yr] = d.split('.').map(s => parseInt(s.trim(), 10)); 
                    return isNaN(yr) ? 0 : new Date(yr, mon - 1, day).getTime(); 
                };
                return parseDate(b.date) - parseDate(a.date) || 
                       (a.file_comment || a.file_name).localeCompare(b.file_comment || b.file_name, 'cs', { numeric: true });
            })
        }))
        .sort((a, b) => a.name === otherFolder ? 1 : b.name === otherFolder ? -1 : a.displayName.localeCompare(b.displayName));
}
