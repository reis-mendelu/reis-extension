import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { downloadErasmusPdf } from '@/utils/erasmusPdf';

export function ErasmusExportButton() {
  const studentInfo = useAppStore(s => s.erasmusStudentInfo);
  const options = useAppStore(s => s.erasmusTableAOptions);
  const tableBCourses = useAppStore(s => s.erasmusTableBCourses);
  const dualPlan = useAppStore(s => s.studyPlanDual);
  const [loading, setLoading] = useState(false);

  // PDF must always use English subject names regardless of UI language (EU guidelines)
  const allSubjects = (dualPlan?.en?.blocks ?? []).flatMap(b => (b.groups ?? []).flatMap(g => g.subjects ?? []));

  const handleExport = async () => {
    setLoading(true);
    try {
      await downloadErasmusPdf(studentInfo, options, tableBCourses, allSubjects);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="btn btn-outline btn-sm gap-2 w-full text-xs font-bold"
    >
      {loading ? <span className="loading loading-spinner loading-xs" /> : <Download size={12} />}
      Export .pdf
    </button>
  );
}
