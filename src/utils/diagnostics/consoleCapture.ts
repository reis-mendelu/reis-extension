import { recordDiagnostic, isInsideLogError } from './diagnosticLog';

// Wraps console.warn / console.error and listens for uncaught errors, so the
// warnings React and our libraries print reach the report form's diagnostic
// log too. Only logError is funnelled otherwise.
//
// Installed EXPLICITLY by each entry (src/entrypoints/main/main.tsx for the app
// on every host, and the content script's main()), never as an import side
// effect: patching console at module evaluation would do it in every graph that
// imports this, including tests and the content script at document_start.

type Level = 'warn' | 'error';

let installed: {
  warn: typeof console.warn;
  error: typeof console.error;
  onError: (e: ErrorEvent) => void;
  onRejection: (e: PromiseRejectionEvent) => void;
} | null = null;

function firstMeaningful(args: unknown[]): unknown {
  return args.find((a) => a instanceof Error) ?? args[0];
}

function wrap(level: Level, original: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    if (!isInsideLogError()) recordDiagnostic({ level, ctx: null, msg: firstMeaningful(args) });
    original.apply(console, args);
  };
}

export function installConsoleCapture(opts: { onlyFilenamePrefix?: string } = {}): void {
  if (installed) return;
  const warn = console.warn;
  const error = console.error;
  const onError = (e: ErrorEvent) => {
    // The content script shares the IS page's window, so IS's own script errors
    // fire here too. They are not ours and can carry IS URLs — drop them.
    if (opts.onlyFilenamePrefix && !(e.filename ?? '').startsWith(opts.onlyFilenamePrefix)) return;
    recordDiagnostic({ level: 'error', ctx: null, msg: e.error ?? e.message });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    recordDiagnostic({ level: 'error', ctx: null, msg: e.reason });
  };
  console.warn = wrap('warn', warn);
  console.error = wrap('error', error);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection as EventListener);
  installed = { warn, error, onError, onRejection };
}

export function uninstallConsoleCaptureForTests(): void {
  if (!installed) return;
  console.warn = installed.warn;
  console.error = installed.error;
  window.removeEventListener('error', installed.onError);
  window.removeEventListener('unhandledrejection', installed.onRejection as EventListener);
  installed = null;
}
