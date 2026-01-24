/**
 * Developer Features Toggle
 * 
 * Utilities to enable/disable hidden features for testing.
 * Accessible via console: window.toggleDevFeatures()
 */

import { loggers } from './logger';
import { IndexedDBService } from '../services/storage';

export const DEV_FEATURES_KEY = 'reis_dev_features'; // Deprecated, kept for cleanup if needed



export const isDevFeaturesEnabled = async () => {
    try {
        // 1. URL Parameter (highest priority)
        if (typeof window !== 'undefined' && window.location.search.includes('reis_dev=1')) {
            return true;
        }
        // 2. IndexedDB
        return await IndexedDBService.get('meta', 'dev_features_enabled') === true;
    } catch {
        return false;
    }
};

export const toggleDevFeatures = async (enable?: boolean) => {
    const newState = enable ?? ! await isDevFeaturesEnabled();
    await IndexedDBService.set('meta', 'dev_features_enabled', newState);
    loggers.system.info('[REIS] Dev features changed. Reloading...', newState ? 'ENABLED' : 'DISABLED');
    
    // Small delay to ensure DB write before reload
    setTimeout(() => {
        window.location.reload();
    }, 200);
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
    window.toggleDevFeatures = toggleDevFeatures;

    const handleMessage = () => {
        loggers.system.info('[REIS] Dev toggle command received!');
        toggleDevFeatures();
    };

    // Extension Isolation Bridges
    // 1. DOM Event
    document.addEventListener('reis-toggle-dev', handleMessage);
    // 2. window.postMessage (Standard for crossing context)
    window.addEventListener('message', (e) => {
        // Security: Only allow toggle from trusted origins
        if (e.origin !== "https://is.mendelu.cz" && !e.origin.startsWith('chrome-extension://')) return;
        
        if (e.data === 'reis-toggle-dev' || e.data?.type === 'reis-toggle-dev') {
            handleMessage();
        }
    });
    
// Help log on first load
    (async () => {
        const hasSeenHelp = await IndexedDBService.get('meta', 'dev_help_shown_v4');
        if (!hasSeenHelp) {
            loggers.system.info('[REIS] Dev Tools Loaded. Use window.toggleDevFeatures() or postMessage to toggle.');
            IndexedDBService.set('meta', 'dev_help_shown_v4', true).catch(console.error);
        }
    })();
}
