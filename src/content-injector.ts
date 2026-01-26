import { startInjection } from "./injector/sniper";
import { handleMessage } from "./injector/messageHandler";
import { stopSyncService } from "./injector/syncService";

if (document.documentElement) {
    document.documentElement.style.visibility = "hidden";
}

startInjection();

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        stopSyncService();
        window.removeEventListener("message", handleMessage);
    });
}
