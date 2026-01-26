import type { Person, Subject } from './types';
import { parseMendeluResults, parseGlobalPeopleResults } from './peopleParser';
import { parseSubjectResults } from './subjectParser';

export async function searchPeople(personName: string): Promise<Person[]> {
    const formData = new URLSearchParams();
    formData.append('vzorek', personName);
    formData.append('cokoliv', '0');
    formData.append('lide', '1');
    formData.append('pocet', '1000');

    try {
        const response = await fetch('https://is.mendelu.cz/auth/lide/index.pl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
            credentials: 'include',
        });

        const html = await response.text();
        return parseMendeluResults(html);
    } catch (error) {
        console.error('Error searching for person:', error);
        return [];
    }
}

export async function searchGlobal(query: string): Promise<{ people: Person[]; subjects: Subject[] }> {
    const formData = new URLSearchParams();
    formData.append('lang', 'cz');
    formData.append('vzorek', query);
    formData.append('vyhledat', 'Vyhledat');
    formData.append('oblasti', 'lide');
    formData.append('oblasti', 'predmety');
    formData.append('pocet', '50');

    try {
        const response = await fetch('https://is.mendelu.cz/auth/hledani/index.pl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
            credentials: 'include',
        });

        const html = await response.text();
        const people = parseGlobalPeopleResults(html);
        const subjects = parseSubjectResults(html);

        return { people, subjects };
    } catch (error) {
        console.error('Error in global search, falling back to people-only:', error);
        const people = await searchPeople(query);
        return { people, subjects: [] };
    }
}
