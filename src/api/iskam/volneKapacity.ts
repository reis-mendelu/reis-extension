import { postIskam } from './client';
import { parseVolneKapacity } from '../../utils/parsers/iskam/volneKapacity';
import type { VolneKapacityRoom } from '../../types/iskam';

export interface IskamCampus {
    name: string;
    blocks: { id: string; label: string }[];
}

export const ISKAM_CAMPUSES: IskamCampus[] = [
    { name: 'JAK',      blocks: [{ id: '1', label: 'A' }, { id: '6', label: 'B' }, { id: '8', label: 'C' }, { id: '12', label: 'D' }] },
    { name: 'Tauferky', blocks: [{ id: '2', label: 'A1' }, { id: '9', label: 'C1' }, { id: '11', label: 'CS' }, { id: '13', label: 'D1' }] },
    { name: 'Lednice',  blocks: [{ id: '3', label: 'A2' }, { id: '7', label: 'B2' }, { id: '10', label: 'C2' }, { id: '14', label: 'D2' }] },
    { name: 'Akademie', blocks: [{ id: '17', label: 'KA' }] },
];

export function academicYearDates(): { od: string; doo: string } {
    const now = new Date();
    const startYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    return { od: `01.09.${startYear}`, doo: `30.06.${startYear + 1}` };
}

export async function fetchVolneKapacityBlock(blockId: string, od: string, doo: string): Promise<VolneKapacityRoom[]> {
    const body = new URLSearchParams({ datumOd: od, datumDo: doo, selBlok: blockId, buttSeek: 'Zobrazit' });
    const html = await postIskam('/VolneKapacity', body);
    return parseVolneKapacity(html);
}
