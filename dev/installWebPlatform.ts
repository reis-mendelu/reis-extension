import { setPlatform } from '@/platform';
import { createWebPlatform } from '@/platform/webPlatform';

// Side-effect module, deliberately. A bare `setPlatform(...)` STATEMENT in
// main.web.tsx would run after every `import` in that file had already been
// evaluated — including the one that boots the app — because import
// declarations hoist. Doing it here means it happens at this module's eval
// time, which respects source order relative to the other imports.
//
// Without it, the shim's fake `chrome.runtime.id` makes getPlatform()
// auto-detect "extension" in the dev webapp. Harmless today, but it would
// silently mask a real host difference later.
setPlatform(createWebPlatform());
