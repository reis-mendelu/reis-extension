import type { Person } from './types';
import { parseMendeluListResults } from './peopleParserResults';
import { parseMendeluProfileResult } from './peopleParserProfile';

export { parseGlobalPeopleResults } from './peopleParserGlobal';

export function parseMendeluResults(htmlString: string): Person[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/lide/";

    // Case 1: Multi-result list
    const listResults = parseMendeluListResults(doc, baseUrl);
    if (listResults.length > 0) return listResults;

    // Case 2: Single profile
    return parseMendeluProfileResult(doc, baseUrl);
}
