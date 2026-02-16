import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SubjectsData, Assessment, SyllabusRequirements, ParsedFile } from '../../types/documents';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';
import type { Classmate } from '../../types/classmates';
import { StoreSchemas, type StoreName } from '../../types/storage';

interface ReisDB extends DBSchema {
    files: {
        key: string;
        value: ParsedFile[] | { cz: ParsedFile[], en: ParsedFile[] }; // Key is courseCode
    };
    assessments: {
        key: string;
        value: Assessment[]; // Key is courseCode
    };
    syllabuses: {
        key: string;
        value: SyllabusRequirements | { cz: SyllabusRequirements, en: SyllabusRequirements }; // Key is courseCode
    };
    classmates: {
        key: string;
        value: Classmate[]; // Key is courseCode
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any;
    };
    meta: {
        key: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any;
    };
}

const DB_NAME = 'reis_db';
const DB_VERSION = 6;

class IndexedDBServiceImpl {
    private dbPromise: Promise<IDBPDatabase<ReisDB>>;

    constructor() {
        this.dbPromise = openDB<ReisDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const requiredStores: (keyof ReisDB)[] = [
                    'files', 'assessments', 'syllabuses', 'classmates',
                    'exams', 'schedule', 'subjects', 'success_rates', 'meta'
                ];
                
                requiredStores.forEach(store => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!db.objectStoreNames.contains(store as any)) {
                        console.log(`[IndexedDB] Creating missing store: ${store}`);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        db.createObjectStore(store as any);
                    }
                });
            },
        });
    }

    private validate<K extends StoreName>(storeName: K, value: unknown): ReisDB[K]['value'] | undefined {
        const schema = StoreSchemas[storeName];
        if (!schema) return value as ReisDB[K]['value'];

        const result = schema.safeParse(value);
        if (!result.success) {
            console.error(`[IndexedDB] Validation failed for store "${storeName}":`, result.error);
            return undefined;
        }
        return result.data;
    }

    async get<K extends StoreName>(storeName: K, key: string): Promise<ReisDB[K]['value'] | undefined> {
        const db = await this.dbPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value = await db.get(storeName as any, key);
        return value ? this.validate(storeName, value) : undefined;
    }

    async set<K extends StoreName>(storeName: K, key: string, value: ReisDB[K]['value']): Promise<void> {
        // Validate before saving to prevent corrupt data ingress
        const validated = this.validate(storeName, value);
        if (validated === undefined && value !== undefined) {
             console.warn(`[IndexedDB] Skipping save to "${storeName}" due to validation error.`);
             return;
        }

        const db = await this.dbPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.put(storeName as any, validated, key);
    }

    async delete<K extends keyof ReisDB>(storeName: K, key: string): Promise<void> {
        const db = await this.dbPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.delete(storeName as any, key);
    }

    async clear<K extends keyof ReisDB>(storeName: K): Promise<void> {
        const db = await this.dbPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.clear(storeName as any);
    }

    async getAll<K extends StoreName>(storeName: K): Promise<ReisDB[K]['value'][]> {
        const db = await this.dbPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values = await db.getAll(storeName as any);
        return values.map(v => this.validate(storeName, v)).filter((v): v is ReisDB[K]['value'] => v !== undefined);
    }

    async getAllWithKeys<K extends StoreName>(storeName: K): Promise<{ key: string, value: ReisDB[K]['value'] }[]> {
        const db = await this.dbPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keys = await db.getAllKeys(storeName as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values = await db.getAll(storeName as any);
        
        return (keys as string[]).map((key, i) => {
            const value = this.validate(storeName, values[i]);
            return value !== undefined ? { key, value } : null;
        }).filter((item): item is { key: string, value: ReisDB[K]['value'] } => item !== null);
    }
}

export const IndexedDBService = new IndexedDBServiceImpl();
