export const LogLevel = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

export interface LoggerConfig { level: LogLevel; showTimestamp: boolean; enabledContexts: Set<string> | 'all'; }
export const config: LoggerConfig = { level: LogLevel.DEBUG, showTimestamp: true, enabledContexts: 'all' };

const COLORS = { debug: 'color: gray', info: 'color: blue', warn: 'color: orange; font-weight: bold', error: 'color: red; font-weight: bold', context: 'color: purple; font-weight: bold', timestamp: 'color: gray; font-style: italic' };

export class Logger {
    constructor(private context: string) {}
    private log(lvl: LogLevel, name: string, col: string, msg: string, ...a: any[]) {
        if (lvl < config.level || (config.enabledContexts !== 'all' && !config.enabledContexts.has(this.context))) return;
        const pts = [], sts = [];
        if (config.showTimestamp) { pts.push(`%c${new Date().toLocaleTimeString()}.${new Date().getMilliseconds().toString().padStart(3, '0')}`); sts.push(COLORS.timestamp); }
        pts.push(`%c[${this.context}]`); sts.push(COLORS.context);
        pts.push(`%c${name}:`); sts.push(col);
        pts.push(`%c${msg}`); sts.push('color: inherit');
        console.log(pts.join(' '), ...sts, ...a);
    }
    debug(m: string, ...a: any[]) { this.log(LogLevel.DEBUG, 'DEBUG', COLORS.debug, m, ...a); }
    info(m: string, ...a: any[]) { this.log(LogLevel.INFO, 'INFO', COLORS.info, m, ...a); }
    warn(m: string, ...a: any[]) { this.log(LogLevel.WARN, 'WARN', COLORS.warn, m, ...a); }
    error(m: string, ...a: any[]) { this.log(LogLevel.ERROR, 'ERROR', COLORS.error, m, ...a); }
    child(c: string) { return new Logger(`${this.context}:${c}`); }
}
