import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePersonProfile } from '../personProfile';

const fixture = (name: string) =>
    readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

const JANDA = fixture('clovek-janda.html');
const KUNRTOVA = fixture('clovek-kunrtova.html');

describe('parsePersonProfile', () => {
    it('extracts the universal fields from Janda profile', () => {
        const r = parsePersonProfile(JANDA, 120349);
        expect(r).not.toBeNull();
        expect(r!.name).toMatch(/Janda/);
        expect(r!.universityEmail).toBe('xjanda@node.mendelu.cz');
        expect(r!.privateEmail).toBe('krystofjanda@protonmail.com');
        expect(r!.programmeCode).toBe('B0613A140025');
        expect(r!.programmeName).toMatch(/Otevřená informatika/);
        expect(r!.studyTypeSentence).toMatch(/Bakalářský/);
        expect(r!.studyTypeSentence).toMatch(/prezenční\s*forma/);
        expect(r!.yearSemesterSentence).toMatch(/\d+\.\s*ročník/);
        expect(r!.yearSemesterSentence).toMatch(/\d+\.\s*semestr studia/);
    });

    it('handles missing private email (Kunrtová)', () => {
        const r = parsePersonProfile(KUNRTOVA, 121037);
        expect(r).not.toBeNull();
        expect(r!.name.length).toBeGreaterThan(0);
        expect(r!.universityEmail).toBeTruthy();
        expect(r!.privateEmail).toBeNull();
        expect(r!.programmeCode).toBe('B0612P140001');
        expect(r!.programmeName).toMatch(/Administrace/);
    });

    it('returns null when html has no name node', () => {
        const r = parsePersonProfile('<html><body>nothing</body></html>', 1);
        expect(r).toBeNull();
    });
});
