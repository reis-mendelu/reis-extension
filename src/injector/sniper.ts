import { IFRAME_ID } from './config';
import { injectIframe } from './iframeManager';
import { handleMessage } from './messageHandler';
import { startSyncService } from './syncGate';
import { scrapeNavMenu } from './menuScraper';
import { sendToIframe } from './iframeManager';
import { Messages } from '../types/messages';
import { setScrapedNavMenu, ensureNavMenuLanguage } from './navMenuLanguage';
import { readSyncLanguage } from '../services/sync/syncLanguage';

let messageHandlerRegistered = false;

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
  const isLandingPage = path === '/' || path === '' || path === '/index.pl';
  const isDashboard = path === '/auth/' || path === '/auth/index.pl';

  if (!isLandingPage && !isDashboard) {
    document.documentElement.style.visibility = 'visible';
    return;
  }

  if (document.body?.innerHTML.includes('/system/login.pl')) {
    document.documentElement.style.visibility = 'visible';
    return;
  }

  // Scrape nav menu after DOM is fully parsed (menu isn't available at document_start)
  const scrapeAndInject = () => {
    if (document.getElementById(IFRAME_ID)) return;

    const scraped = scrapeNavMenu(document);
    if (scraped) {
      // The page's own labels go out at once; the student's language is
      // fetched only if the page is in the other one.
      setScrapedNavMenu(scraped);
      void readSyncLanguage().then((lang) =>
        ensureNavMenuLanguage(lang, (menu) => sendToIframe(Messages.navMenu(menu)))
      );
    }

    injectIframe();
    listenForSearchShortcut();
    if (!messageHandlerRegistered) {
      window.addEventListener('message', handleMessage);
      messageHandlerRegistered = true;
    }
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
