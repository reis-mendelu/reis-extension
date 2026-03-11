// Brand Icons
// Teams and Outlook icons are now using Lucide React icons in Sidebar.tsx
// Mendelu logo is imported from assets in components

export const REIS_LOGO_PATH = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL("reIS_logo.svg") : "reIS_logo.svg";
/** @deprecated Use REIS_LOGO_PATH */
export const MENDELU_LOGO_PATH = REIS_LOGO_PATH;
export const OUTLOOK_ICON_PATH = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL("outlook_icon_48.png") : "outlook_icon_48.png";
export const TEAMS_ICON_PATH = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL("teams_icon_48.png") : "teams_icon_48.png";
