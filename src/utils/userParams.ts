import { IndexedDBService } from "../services/storage";
import { STORAGE_KEYS } from "../services/storage/keys";
import { fetchUserBaseIds, fetchUserStudyDetails, fetchUserNetId } from "./userParams/fetchers";

export interface UserParams {
    studium: string; obdobi: string; facultyId: string; username: string; email?: string;
    studentId: string; fullName: string; studyCode?: string; facultyLabel?: string;
    studyProgram?: string; studyForm?: string; studySemester?: number; studyYear?: number;
    periodLabel?: string; isErasmus: boolean;
}

export async function getUserParams(): Promise<UserParams | null> {
    const cached = await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS);
    if (cached?.studium && cached?.obdobi) return cached;

    try {
        const base = await fetchUserBaseIds(); if (!base) return null;
        const study = await fetchUserStudyDetails(), net = await fetchUserNetId();
        const params: UserParams = { ...base, ...study, ...net, email: net.username ? `${net.username}@mendelu.cz` : '' };
        await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, params);
        return params;
    } catch (e) { console.error(e); return null; }
}

export async function getStudium(): Promise<string | null> { return (await getUserParams())?.studium ?? null; }
export async function getFaculty(): Promise<string | null> { return (await getUserParams())?.facultyId ?? null; }
export async function getErasmus(): Promise<boolean> { return (await getUserParams())?.isErasmus ?? false; }
