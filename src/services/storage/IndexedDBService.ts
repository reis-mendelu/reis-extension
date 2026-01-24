import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StudyProgramData } from '../../api/studyProgram';
import type { SubjectsData, Assessment, SyllabusRequirements, ParsedFile } from '../../types/documents';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';

interface ReisDB extends DBSchema {
    study_program: {
        key: string; // 'current' or specific ID
        value: StudyProgramData;
    };
    files: {
        key: string;
        value: ParsedFile[]; // Key is courseCode
    };
    assessments: {
        key: string;
        value: Assessment[]; // Key is courseCode
    };
    syllabuses: {
        key: string;
        value: SyllabusRequirements; // Key is courseCode
    };
    exams: {
        key: string;
        value: ExamSubject[];
    };
    schedule: {
        key: string;
        value: BlockLesson[];
    };
    subjects: {
        key: string;
        value: SubjectsData;
    };
    success_rates: {
        key: string;
        value: any;
    };
    meta: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'reis_db';
const DB_VERSION = 3; // Bumped to force repair of missing stores

class IndexedDBServiceImpl {
    private dbPromise: Promise<IDBPDatabase<ReisDB>>;

    constructor() {
        this.dbPromise = openDB<ReisDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const requiredStores: (keyof ReisDB)[] = [
                    'study_program', 'files', 'assessments', 'syllabuses', 
                    'exams', 'schedule', 'subjects', 'success_rates', 'meta'
                ];
                
                requiredStores.forEach(store => {
                    if (!db.objectStoreNames.contains(store as any)) {
                        console.log(`[IndexedDB] Creating missing store: ${store}`);
                        db.createObjectStore(store as any);
                    }
                });
            },
        });
    }

    async get<K extends keyof ReisDB>(storeName: K, key: string): Promise<ReisDB[K]['value'] | undefined> {
        const db = await this.dbPromise;
        return db.get(storeName as any, key);
    }

    async set<K extends keyof ReisDB>(storeName: K, key: string, value: ReisDB[K]['value']): Promise<void> {
        const db = await this.dbPromise;
        await db.put(storeName as any, value, key);
    }

    async delete<K extends keyof ReisDB>(storeName: K, key: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete(storeName as any, key);
    }

    async clear<K extends keyof ReisDB>(storeName: K): Promise<void> {
        const db = await this.dbPromise;
        await db.clear(storeName as any);
    }

    async getAll<K extends keyof ReisDB>(storeName: K): Promise<ReisDB[K]['value'][]> {
        const db = await this.dbPromise;
        return db.getAll(storeName as any);
    }

    async getAllWithKeys<K extends keyof ReisDB>(storeName: K): Promise<{ key: string, value: ReisDB[K]['value'] }[]> {
        const db = await this.dbPromise;
        const keys = await db.getAllKeys(storeName as any);
        const values = await db.getAll(storeName as any);
        return (keys as string[]).map((key, i) => ({ key, value: values[i] }));
    }
}

export const IndexedDBService = new IndexedDBServiceImpl();
