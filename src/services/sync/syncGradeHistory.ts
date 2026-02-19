import { IndexedDBService } from '../storage';
import { fetchGradeHistory } from '../../api/gradeHistory';
import { getUserParams } from '../../utils/userParams';

export async function syncGradeHistory(): Promise<void> {
    const userParams = await getUserParams();
    if (!userParams?.studium || !userParams?.obdobi) {
        console.warn('[syncGradeHistory] Missing userParams, skipping');
        return;
    }
    const data = await fetchGradeHistory(userParams.studium, userParams.obdobi);
    if (data) {
        await IndexedDBService.set('grade_history', 'all', data);
        console.log(`[syncGradeHistory] Stored ${data.grades.length} course grades`);
    }
}
