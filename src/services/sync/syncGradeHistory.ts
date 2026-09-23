import { IndexedDBService } from '../storage';
import { fetchGradeHistory } from '../../api/gradeHistory';
import { getUserParams } from '../../utils/userParams';

export async function syncGradeHistory(): Promise<void> {
  const userParams = await getUserParams();
  if (!userParams?.studium || !userParams?.obdobi) {
    return;
  }
  const data = await fetchGradeHistory(userParams.studium, userParams.obdobi);
  if (data) {
    await IndexedDBService.set('grade_history', 'all', data);
  }
}
