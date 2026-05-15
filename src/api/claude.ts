const SUPABASE_URL = 'https://zvbpgkmnrqyprtkyxkwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YnBna21ucnF5cHJ0a3l4a3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDU5NjYsImV4cCI6MjA4NDMyMTk2Nn0.8eaGOhlZHUf9uOlb6vL_P5D61bILFdgSu245kaIhMvQ';
const PROXY_ENDPOINT = `${SUPABASE_URL}/functions/v1/claude-proxy`;

export interface AIComparisonResult {
  similarity: number;
  verdict: 'approved' | 'rejected';
  reasoning: string;
  mismatches: string[];
  creditsMatch: boolean;
  typeMatch: boolean;
}

async function askClaude(
  prompt: string,
  systemInstruction?: string,
  pdfBase64?: string,
  foreignText?: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
      body: JSON.stringify({ prompt, systemInstruction, pdfBase64, foreignText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Proxy Error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    if (!data.text) throw new Error('Empty response from Claude proxy');
    return data.text;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude API request timed out (45s). Please try again.');
    }
    throw error;
  }
}

export async function compareSyllabiAI(
  mendeluSyllabus: string,
  mendeluMetadata: { credits: number; type: string; code: string; name: string },
  pdfBase64?: string,
  foreignText?: string,
): Promise<AIComparisonResult> {
  if (
    mendeluMetadata.code.toUpperCase().startsWith('EXA-UP') ||
    mendeluMetadata.name.toLowerCase().includes('uznaný předmět') ||
    mendeluMetadata.name.toLowerCase().includes('recognized subject')
  ) {
    return {
      similarity: 1.0,
      verdict: 'approved',
      reasoning: 'Automaticky schváleno. Předměty typu "Uznaný předmět ze zahraničního výjezdu" slouží jako volitelný blok a nevyžadují obsahovou shodu.',
      mismatches: [],
      creditsMatch: true,
      typeMatch: true,
    };
  }

  const prompt = `
COMPARE THESE TWO COURSE SYLLABI FOR ERASMUS RECOGNITION.

MENDELU COURSE (HOME):
- Code: ${mendeluMetadata.code}
- Name: ${mendeluMetadata.name}
- Credits: ${mendeluMetadata.credits} ECTS
- Type: ${mendeluMetadata.type} (zk = Exam, zap/zak = Credit only)
- Content: ${mendeluSyllabus && mendeluSyllabus.trim().length > 0 ? mendeluSyllabus : '!!! CONTENT MISSING !!! The official syllabus was not found automatically. DO NOT hallucinate its contents. You MUST evaluate strictly from the NAME of the course alone if content is missing.'}

FOREIGN COURSE (CANDIDATE):
${foreignText ? `Text content provided separately.` : 'Please extract content from the attached PDF document.'}

RECOGNITION RULES:
1. Learning Outcomes: Focus on the CORE 60-70% overlap. Do not be overly strict about missing theoretical sub-topics if the main applied topics are present.
2. Missing Home Content: If MENDELU Content says "CONTENT MISSING", you MUST NOT assume it matches the foreign course.
3. Credits: Foreign ECTS should ideally be >= Home ECTS. A 1-credit deficit is VERY OFTEN accepted and should NOT be a reason for rejection.
4. Type Mismatch: Only reject if there is a massive gap (e.g., a 10-credit Exam course being replaced by a 2-credit workshop).
5. Tone: Be a "Helpful Advisor," not a "Hostile Bureaucrat."

OUTPUT FORMAT (JSON ONLY, no markdown):
{
  "similarity": 0.0-1.0,
  "verdict": "approved" | "rejected",
  "reasoning": "Dvě stručné a úderné věty v češtině. MUSÍŠ výslovně uvést do jedné věty název obou předmětů. Buď naprosto věcný a opírej se o důkazy ze sylabu. NIKDY nepiš, že jsi AI.",
  "mismatches": ["seznam věcí k diskusi s koordinátorem"],
  "creditsMatch": true/false,
  "typeMatch": true/false
}
`;

  const systemInstruction = "You are a senior academic advisor at Mendel University in Brno. You are an expert at evaluating syllabus equivalence for Erasmus+ students. You are strict but fair, ensuring MENDELU standards are met while supporting student mobility. Always respond with valid JSON only, no markdown fences.";

  const responseText = await askClaude(prompt, systemInstruction, pdfBase64, foreignText);

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI failed to return a structured JSON response. Raw output: " + responseText.substring(0, 100) + "...");
  }

  return JSON.parse(jsonMatch[0]) as AIComparisonResult;
}
