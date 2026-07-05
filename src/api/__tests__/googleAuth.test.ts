import { describe, expect, it } from 'vitest';
import { GOOGLE_CLIENT_ID } from '../googleAuth';

describe('googleAuth config', () => {
    // The client ID must survive builds that have no .env (CI, fresh clones).
    // A missing ID made every connectGoogle() throw in production builds.
    it('resolves a Google OAuth client ID without any env vars', () => {
        expect(GOOGLE_CLIENT_ID).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
    });
});
