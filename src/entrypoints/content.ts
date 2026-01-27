import { startInjection } from "@/injector/sniper";
import { handleMessage } from "@/injector/messageHandler";
import { stopSyncService } from "@/injector/syncService";

export default defineContentScript({
  matches: [
      "https://is.mendelu.cz/auth/",
      "https://is.mendelu.cz/auth/?*",
      "https://is.mendelu.cz/auth/index.pl*"
  ],
  runAt: "document_start",
  main() {
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
  },
});
