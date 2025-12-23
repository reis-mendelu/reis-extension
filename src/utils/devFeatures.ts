/**
 * Developer Features Toggle
 * 
 * Utilities to enable/disable hidden features for testing.
 * accessible via console: window.toggleDevFeatures()
 */

export const DEV_FEATURES_KEY = 'reis_dev_features';

export const isDevFeaturesEnabled = () => {
    try {
        // 1. URL Parameter (highest priority, persistent via browser history/reload if kept in URL)
        if (typeof window !== 'undefined' && window.location.search.includes('reis_dev=1')) {
            return true;
        }
        // 2. localStorage
        return localStorage.getItem(DEV_FEATURES_KEY) === 'true';
    } catch {
        return false;
    }
};

export const toggleDevFeatures = (enable?: boolean) => {
    const newState = enable ?? !isDevFeaturesEnabled();
    localStorage.setItem(DEV_FEATURES_KEY, String(newState));
    console.log(`%c[REIS] Dev features ${newState ? 'ENABLED' : 'DISABLED'}. Reloading...`, 'color: #00ff00; font-weight: bold;');
    
    // Small delay to ensure localStorage is written before reload in some browsers
    setTimeout(() => {
        window.location.reload();
    }, 100);
};

// Type definition for window
declare global {
    interface Window {
        toggleDevFeatures: typeof toggleDevFeatures;
    }
}

// Auto-register when imported
if (typeof window !== 'undefined') {
    // Explicitly cast to any to ensure runtime assignment works despite TS
    (window as any).toggleDevFeatures = toggleDevFeatures;

    const handleMessage = () => {
        console.log('%c[REIS] Dev toggle command received!', 'color: #00ff00; font-weight: bold;');
        toggleDevFeatures();
    };

    // Extension Isolation Bridges
    // 1. DOM Event
    document.addEventListener('reis-toggle-dev', handleMessage);
    // 2. window.postMessage (Standard for crossing context)
    window.addEventListener('message', (e) => {
        if (e.data === 'reis-toggle-dev' || e.data?.type === 'reis-toggle-dev') {
            handleMessage();
        }
    });
    
    // Log help message on first load
    const HELP_KEY = 'reis_dev_help_shown_v4';
    if (!localStorage.getItem(HELP_KEY)) {
        console.log(
            '%c[REIS] Dev Tools Loaded.\n' +
            'If window.toggleDevFeatures() is undefined, try these in console:\n' +
            'A) window.postMessage("reis-toggle-dev", "*")\n' +
            'B) Add ?reis_dev=1 to your URL',
            'color: #00ff00; font-weight: bold;'
        );
        localStorage.setItem(HELP_KEY, 'true');
    }
}
