/**
 * Configuration for API endpoints
 * 
 * During development, you can use the CORS Everywhere browser extension
 * to bypass CORS restrictions when testing locally.
 * 
 * Firefox extension: https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/
 * 
 * To use:
 * 1. Install CORS Everywhere extension
 * 2. Enable it (icon turns green)
 * 3. Run `npm run dev:all` to start development with auto-reload
 */

export const BASE_URL = 'https://is.mendelu.cz';

/**
 * Constructs a full URL from a relative path
 * @param path - The relative path (e.g., "auth/student/studium.pl")
 * @returns The full URL
 */
export function buildUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}/${cleanPath}`;
}
