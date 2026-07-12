// Dev webapp entry: install the chrome shim BEFORE the app (and its transitive
// imports like icons.ts that read chrome.runtime.getURL at module eval), then
// boot the real reIS app exactly as the extension does.
import './chromeShim';
import '@/entrypoints/main/main';
