const API_BASE = 'https://darksoothingshadow-reis-syllabus-similarity.hf.space';

export type TransferVerdict = 'approved' | 'rejected';

export interface TransferResult {
  similarity: number;
  verdict: TransferVerdict;
}

export function buildMendeluText(syllabus: {
  courseInfo?: { courseNameEn?: string | null; courseNameCs?: string | null } | null;
  objectivesText?: string | null;
  contentText?: string | null;
}): string {
  const parts = [
    syllabus.courseInfo?.courseNameEn ?? syllabus.courseInfo?.courseNameCs,
    syllabus.objectivesText,
    syllabus.contentText,
  ].filter(Boolean);
  return parts.join('\n\n');
}

export async function warmupTransferApi(): Promise<void> {
  await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
}

export async function compareSyllabi(a: string, b: string): Promise<TransferResult> {
  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ a, b }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Transfer API error: ${res.status}`);

  const { similarity } = await res.json() as { similarity: number };

  const verdict: TransferVerdict = similarity >= 0.65 ? 'approved' : 'rejected';

  return { similarity, verdict };
}
