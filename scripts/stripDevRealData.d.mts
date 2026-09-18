// Types for the plain-JS strip module. It stays .mjs because Vite and WXT both
// load it directly from config files, before any TS transform is available.
import type { Plugin } from 'vite';

export declare const DEV_REAL_DATA_FILENAME: string;
export declare const PREVIEW_DATA_FILENAME: string;
/** Every local snapshot that must never appear in a build output. */
export declare const SNAPSHOT_FILENAMES: string[];
export declare function stripDevRealDataFile(outDir: string, filenames?: string[]): void;
export declare function stripDevRealDataPlugin(filenames?: string[]): Plugin;
