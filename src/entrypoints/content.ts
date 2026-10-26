import { defineContentScript } from 'wxt/utils/define-content-script';
import { startInjection } from '@/injector/sniper';
import { handleMessage } from '@/injector/messageHandler';
import { stopSyncService } from '@/injector/syncGate';
import { startBgPokeListener } from '@/injector/bgPokeListener';
import { setDiagnosticSource } from '@/utils/diagnostics/diagnosticLog';
import { installConsoleCapture } from '@/utils/diagnostics/consoleCapture';

export default defineContentScript({
  matches: [
    'https://is.mendelu.cz/auth/',
    'https://is.mendelu.cz/auth/?*',
    'https://is.mendelu.cz/auth/index.pl*',
  ],
  runAt: 'document_start',
  main() {
    // The IS fetching and parsing run here, so this is where most extension
    // failures happen. The iframe asks for these with the `get_diagnostics`
    // action when the report form opens. The prefix keeps IS's own script
    // errors out: this context shares the host page's window. From the
    // runtime, not a literal, because Firefox serves us from moz-extension://.
    setDiagnosticSource('content');
    installConsoleCapture({ onlyFilenamePrefix: chrome.runtime.getURL('') });

    if (document.documentElement) {
      document.documentElement.style.visibility = 'hidden';
    }

    startInjection();
    startBgPokeListener();

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        stopSyncService();
        window.removeEventListener('message', handleMessage);
      });
    }
  },
});
