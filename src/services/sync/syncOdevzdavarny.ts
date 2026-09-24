import { fetchOdevzdavarny, type OdevzdavarnyResult } from '../../api/odevzdavarny';
import { IndexedDBService } from '../storage/IndexedDBService';

export async function syncOdevzdavarny(
  studium: string,
  obdobi: string
): Promise<OdevzdavarnyResult | null> {
  const result = await fetchOdevzdavarny(studium, obdobi);
  if (result && result.assignments.length > 0) {
    await IndexedDBService.set('odevzdavarny', `${studium}_${obdobi}`, result.assignments);
  }
  return result;
}
