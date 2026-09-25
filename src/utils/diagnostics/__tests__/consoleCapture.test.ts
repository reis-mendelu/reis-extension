import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearDiagnostics, getDiagnostics } from '../diagnosticLog';
import { installConsoleCapture, uninstallConsoleCaptureForTests } from '../consoleCapture';
import { logError } from '../../reportError';

describe('console capture', () => {
  let warn: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  let error: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  const realWarn = console.warn;
  const realError = console.error;

  beforeEach(() => {
    warn = vi.fn<(...args: unknown[]) => void>();
    error = vi.fn<(...args: unknown[]) => void>();
    console.warn = warn;
    console.error = error;
    clearDiagnostics();
  });

  afterEach(() => {
    uninstallConsoleCaptureForTests();
    console.warn = realWarn;
    console.error = realError;
  });

  it('records console.warn and still prints it', () => {
    installConsoleCapture();
    console.warn('careful', 1);
    expect(warn).toHaveBeenCalledWith('careful', 1);
    expect(getDiagnostics()).toMatchObject([{ level: 'warn', ctx: null, msg: 'careful' }]);
  });

  it('records console.error', () => {
    installConsoleCapture();
    console.error(new Error('bad'));
    expect(getDiagnostics()).toMatchObject([{ level: 'error', ctx: null, msg: 'bad' }]);
  });

  it('records a logError failure exactly once, with its context and status', () => {
    installConsoleCapture();
    logError('Api.fetchExams', Object.assign(new Error('boom'), { status: 503 }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(getDiagnostics()).toMatchObject([
      { level: 'error', ctx: 'Api.fetchExams', status: 503, msg: 'boom' },
    ]);
  });

  it('logError records even when capture is not installed', () => {
    logError('Parser.parseX', 'nope');
    expect(getDiagnostics()).toMatchObject([{ ctx: 'Parser.parseX', msg: 'nope' }]);
  });

  it('is idempotent', () => {
    installConsoleCapture();
    installConsoleCapture();
    console.warn('once');
    expect(getDiagnostics()).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('records uncaught errors and unhandled rejections', () => {
    installConsoleCapture();
    window.dispatchEvent(new ErrorEvent('error', { message: 'uncaught', filename: 'x.js' }));
    const ev = new Event('unhandledrejection') as Event & { reason: unknown };
    ev.reason = new Error('rejected');
    window.dispatchEvent(ev);
    expect(getDiagnostics().map((e) => e.msg)).toEqual(['uncaught', 'rejected']);
  });

  it('with a filename prefix, drops errors thrown by the host page', () => {
    installConsoleCapture({ onlyFilenamePrefix: 'chrome-extension://' });
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'IS own', filename: 'https://is.mendelu.cz/a.js' })
    );
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'ours', filename: 'chrome-extension://abc/content.js' })
    );
    expect(getDiagnostics().map((e) => e.msg)).toEqual(['ours']);
  });
});
