import { fetchCvicneTests, type CvicneTestsResult } from '../../api/cvicneTests';
import { IndexedDBService } from '../storage/IndexedDBService';

export async function syncCvicneTests(studium: string): Promise<CvicneTestsResult | null> {
    const result = await fetchCvicneTests(studium);
    if (result && result.tests.length > 0) {
        await IndexedDBService.set('cvicne_tests', studium, result.tests);
    }
    return result;
}
