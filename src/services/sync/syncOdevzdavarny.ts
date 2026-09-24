import { fetchOdevzdavarny, type OdevzdavarnyResult } from '../../api/odevzdavarny';
import { IndexedDBService } from '../storage/IndexedDBService';
import type { FetchLanguage } from '../../api/fetchLanguage';

export async function syncOdevzdavarny(
  studium: string,
  obdobi: string,
  lang: FetchLanguage
): Promise<OdevzdavarnyResult | null> {
  const result = await fetchOdevzdavarny(studium, obdobi, lang);
  if (result && result.assignments.length > 0) {
    await IndexedDBService.set('odevzdavarny', `${studium}_${obdobi}`, result.assignments);
  }
  return result;
}
