import { Logger, LogLevel, config } from './logger/LoggerCore';

export { LogLevel, Logger };
export function createLogger(c: string) { return new Logger(c); }

export const loggers = {
    api: createLogger('API'),
    sync: createLogger('Sync'),
    storage: createLogger('Storage'),
    files: createLogger('Files'),
    ui: createLogger('UI'),
    auth: createLogger('Auth'),
    system: createLogger('System'),
};

export function configureLogger(o: any) { Object.assign(config, o); }
export function disableLogging() { config.level = LogLevel.OFF; }
export function enableVerboseLogging() { config.level = LogLevel.DEBUG; }

/**
 * Extended functionality for API logging
 */
export async function logFetch<T>(context: string, url: string, opts?: any, parser?: (r: Response) => Promise<T>) {
    const l = createLogger(context), start = performance.now(), method = opts?.method || 'GET';
    l.debug(`→ ${method} ${url}`);
    try {
        const res = await fetch(url, opts), ms = Math.round(performance.now() - start);
        if (!res.ok) { l.warn(`← ${method} ${url} - ${res.status} (${ms}ms)`); return { data: null, res, error: null, ms }; }
        const data = parser ? await parser(res) : (await res.text()) as unknown as T;
        l.info(`← ${method} ${url} - ${res.status} OK (${ms}ms)`);
        return { data, res, error: null, ms };
    } catch (e) {
        const ms = Math.round(performance.now() - start);
        l.error(`✗ ${method} ${url} - Failed (${ms}ms)`, e);
        return { data: null, res: null, error: e as Error, ms };
    }
}
