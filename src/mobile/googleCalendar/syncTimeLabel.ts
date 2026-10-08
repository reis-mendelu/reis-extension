/** "14:02" in the app's language; '' before the first sync. Shared with the Profil row. */
export function syncTimeLabel(lastSyncAt: number | null, language: 'cz' | 'en'): string {
  if (!lastSyncAt) return '';
  return new Date(lastSyncAt).toLocaleTimeString(language === 'cz' ? 'cs' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
