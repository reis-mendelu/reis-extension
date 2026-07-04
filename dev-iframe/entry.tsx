// Boots the REAL reIS iframe app at an http origin for Chrome MCP debugging.
// chromeStub MUST be imported before main.tsx so the store finds chrome.storage.
import './chromeStub';
import '@/entrypoints/main/main.tsx';
