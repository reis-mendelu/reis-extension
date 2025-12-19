import { Task, Wait, Duration } from '@serenity-js/core';
import { Navigate, Page } from '@serenity-js/web';
import { equals, not } from '@serenity-js/assertions';

/**
 * Opens the Chrome extension popup by navigating to its index.html
 */
export const OpenExtensionPopup = (extensionId: string) =>
    Task.where(`#actor opens the extension popup`,
        Navigate.to(`chrome-extension://${extensionId}/index.html`)
    );

/**
 * Waits for the React app to hydrate and become interactive
 */
export const WaitForHydration = () =>
    Task.where(`#actor waits for app hydration`,
        Wait.until(Page.current().title(), not(equals(''))),
        Wait.for(Duration.ofMilliseconds(500))
    );
