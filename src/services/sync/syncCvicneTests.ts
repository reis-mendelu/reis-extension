import { fetchCvicneTests, type CvicneTestsResult } from '../../api/cvicneTests';
import { IndexedDBService } from '../storage/IndexedDBService';
import type { FetchLanguage } from '../../api/fetchLanguage';

export async function syncCvicneTests(
  studium: string,
  lang: FetchLanguage
): Promise<CvicneTestsResult | null> {
  const result = await fetchCvicneTests(studium, lang);
  if (result && result.tests.length > 0) {
    await IndexedDBService.set('cvicne_tests', studium, result.tests);
  }
  return result;
}
