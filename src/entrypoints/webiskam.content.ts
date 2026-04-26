import { defineContentScript } from 'wxt/utils/define-content-script';
import { startIskamInjection } from '@/injector/iskamInjector';
import { handleIskamMessage } from '@/injector/iskamMessageHandler';
import { startIskamSync } from '@/injector/iskamSyncService';
import { ISKAM_ENABLED } from '@/config/featureFlags';

export default defineContentScript({
    matches: [
        'https://webiskam.mendelu.cz/ObjednavkyStravovani',
        'https://webiskam.mendelu.cz/ObjednavkyStravovani/*',
    ],
    runAt: 'document_start',
    main() {
        if (!ISKAM_ENABLED) return;

        // Reset the document stream before the browser can parse/execute any
        // of WebISKAM's own scripts (e.g. jquery.unobtrusive-ajax which calls
        // the removed $.live() API). This gives us a clean slate immediately.
        document.open();
        document.write('<!DOCTYPE html><html><head></head><body></body></html>');
        document.close();

        startIskamInjection();
        window.addEventListener('message', handleIskamMessage);
        startIskamSync();

        if (import.meta.hot) {
            import.meta.hot.dispose(() => {
                window.removeEventListener('message', handleIskamMessage);
            });
        }
    },
});
