import { IndexedDBService } from '../storage';
import { fetchDualLanguageIskam } from '../../api/iskam';

export async function syncIskam(): Promise<void> {
    const data = await fetchDualLanguageIskam();
    await IndexedDBService.set('iskam', 'current', data);
}
