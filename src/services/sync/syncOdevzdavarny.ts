import { fetchOdevzdavarny, type OdevzdavarnyResult } from '../../api/odevzdavarny';
import { IndexedDBService } from '../storage/IndexedDBService';

export async function syncOdevzdavarny(
  studium: string,
  obdobi: string
): Promise<OdevzdavarnyResult | null> {
  const result = await fetchOdevzdavarny(studium, obdobi);
  // An empty list is stored too: the parser answers null for a page it does
  // not recognise, so [] really means "no boxes" and must clear deleted ones.
  if (result) {
    await IndexedDBService.set('odevzdavarny', `${studium}_${obdobi}`, result.assignments);
  }
  return result;
}
