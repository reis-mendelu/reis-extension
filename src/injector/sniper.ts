import { IFRAME_ID } from './config';
import { injectIframe } from './iframeManager';
import { handleMessage } from './messageHandler';
import { startSyncService } from './syncService';
import { scrapeNavMenu, fetchOtherLanguage, mergeDual } from './menuScraper';
import { sendToIframe } from './iframeManager';
import { Messages } from '../types/messages';
import type { PageCategory } from '../data/pages/types';

export let scrapedNavMenu: PageCategory[] | null = null;

export function startInjection() {
    if (document.body) {
        injectAndInitialize();
    } else {
        const observer = new MutationObserver((_mutations, obs) => {
            if (document.body) {
                obs.disconnect();
                injectAndInitialize();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }
}

function injectAndInitialize() {
    if (document.getElementById(IFRAME_ID)) return;

    const path = window.location.pathname;
    const isLandingPage = path === "/" || path === "" || path === "/index.pl";
    const isDashboard = path === "/auth/" || path === "/auth/index.pl";

    if (!isLandingPage && !isDashboard) {
        document.documentElement.style.visibility = "visible";
        return;
    }

    if (document.body?.innerHTML.includes("/system/login.pl")) {
        document.documentElement.style.visibility = "visible";
        return;
    }

    // Scrape nav menu after DOM is fully parsed (menu isn't available at document_start)
    const scrapeAndInject = () => {
        if (document.getElementById(IFRAME_ID)) return;

        const scraped = scrapeNavMenu(document);
        if (scraped) {
            // Send single-language version immediately so iframe doesn't wait
            scrapedNavMenu = mergeDual(scraped.categories, scraped.lang, null);

            // Fetch other language in background, update when ready
            fetchOtherLanguage(scraped.lang).then(other => {
                scrapedNavMenu = mergeDual(scraped.categories, scraped.lang, other);
                sendToIframe(Messages.navMenu(scrapedNavMenu));
            });
        }

        injectIframe();
        listenForSearchShortcut();
        window.addEventListener("message", handleMessage);
        startSyncService();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scrapeAndInject, { once: true });
    } else {
        scrapeAndInject();
    }
}

function listenForSearchShortcut() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
            if (iframe) {
                iframe.focus();
                iframe.contentWindow?.postMessage({ type: 'REIS_OPEN_SEARCH' }, '*');
            }
        }
    });
}
