/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Outlook Sync API - Check and set calendar sync status with IS Mendelu.
 * 
 * Syncs both:
 * - zdroj=1 (Výuka - lectures)
 * - zdroj=4 (Zkoušky - exams)
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('OutlookSync');

const SYNC_URL = 'https://is.mendelu.cz/auth/ca/konfigurace_prenosu_udalosti.pl';
const SOURCES = [1, 4] as const; // 1 = Výuka, 4 = Zkoušky

/**
 * Check current Outlook sync status for both sources.
 * Returns true only if BOTH sources have sync enabled.
 */
export async function checkOutlookSyncStatus(): Promise<boolean> {
    logger.debug('Checking Outlook sync status...');

    try {
        const results = await Promise.all(
            SOURCES.map(async (id) => {
                const label = id === 1 ? 'Výuka' : 'Zkoušky';
                logger.debug(`Fetching status for ${label} (zdroj=${id})`);

                const response = await fetch(`${SYNC_URL}?editace=1;zdroj=${id};lang=cz`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    logger.warn(`Failed to fetch ${label}: ${response.status}`);
                    return false;
                }

                const html = await response.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const activeInput = doc.querySelector('input[name="prenos_o365"][value="1"]');
                const isActive = activeInput?.hasAttribute('checked') ?? false;

                logger.debug(`${label}: ${isActive ? '✅ ENABLED' : '❌ DISABLED'}`);
                return isActive;
            })
        );

        // Both must be enabled for overall status to be "enabled"
        const allEnabled = results.every(Boolean);
        logger.info(`Overall sync status: ${allEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);

        return allEnabled;
    } catch (error) {
        logger.error('Failed to check sync status:', error);
        return false;
    }
}

/**
 * Set Outlook sync status for both sources.
 * @param enabled - true to enable, false to disable
 * @returns true if successful, false otherwise
 */
export async function setOutlookSyncStatus(enabled: boolean): Promise<boolean> {
    const action = enabled ? 'ENABLING' : 'DISABLING';
    logger.info(`${action} Outlook sync for all sources...`);

    try {
        const results = await Promise.all(
            SOURCES.map(async (id) => {
                const label = id === 1 ? 'Výuka' : 'Zkoušky';
                logger.debug(`${action} ${label} (zdroj=${id})`);

                const response = await fetch(SYNC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: `lang=cz&editace=1&zdroj=${id}&prenos_o365=${enabled ? 1 : 0}&ulozit=Uložit`
                });

                if (!response.ok) {
                    logger.warn(`Failed to set ${label}: ${response.status}`);
                    return false;
                }

                logger.debug(`${label}: ${action} successful`);
                return true;
            })
        );

        const allSuccess = results.every(Boolean);
        if (allSuccess) {
            logger.info(`✅ Sync ${enabled ? 'ENABLED' : 'DISABLED'} for all sources`);
        } else {
            logger.warn(`⚠️ Some sources failed to update`);
        }

        return allSuccess;
    } catch (error) {
        logger.error('Failed to set sync status:', error);
        return false;
    }
}
