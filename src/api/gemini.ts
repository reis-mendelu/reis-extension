/**
 * Gemini API Client (via Supabase Proxy)
 * 
 * Provides methods for interacting with Google's Gemini models
 * through a secure Supabase Edge Function to protect the API key.
 */

const SUPABASE_URL = 'https://zvbpgkmnrqyprtkyxkwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YnBna21ucnF5cHJ0a3l4a3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDU5NjYsImV4cCI6MjA4NDMyMTk2Nn0.8eaGOhlZHUf9uOlb6vL_P5D61bILFdgSu245kaIhMvQ';
const PROXY_ENDPOINT = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

export interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings?: { category: string; probability: string }[];
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Standard "Hello World" test for Gemini API.
 */
export async function testGeminiConnection(): Promise<string> {
  return askGemini("Say 'Hello World from reIS! (via Supabase Proxy)'");
}

/**
 * Sends a prompt with optional system instruction to Gemini via Supabase proxy.
 * Includes automatic retry for quota limits.
 */
export async function askGemini(prompt: string, systemInstruction?: string, pdfBase64?: string, retryCount = 0): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration (URL or Anon Key) is missing in .env');
  }

  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ prompt, systemInstruction, pdfBase64 })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      const errorMessage = errorData.error || `Proxy Error: ${response.statusText}`;

      // Handle Quota Limit (429 or specific error message)
      const isQuotaError = response.status === 429 || 
                          errorMessage.toLowerCase().includes('quota exceeded') || 
                          errorMessage.toLowerCase().includes('rate limit');

      if (isQuotaError && retryCount < MAX_RETRIES) {
        // Exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.warn(`[Gemini] Quota limit hit. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return askGemini(prompt, systemInstruction, pdfBase64, retryCount + 1);
      }

      throw new Error(`Gemini API Error: ${errorMessage}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from Gemini');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    if (retryCount < MAX_RETRIES && (error instanceof Error && error.message.includes('fetch'))) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.warn(`[Gemini] Network error. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return askGemini(prompt, systemInstruction, pdfBase64, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Extracts syllabus text from a PDF file using Gemini.
 * It focuses on learning objectives, topics/content, and assessment methods.
 */
export async function extractSyllabusFromPdf(pdfBase64: string): Promise<string> {
  const prompt = "Extract the course syllabus information from this document. I need: \n1. Course Name\n2. Learning Objectives/Outcomes\n3. Course Content/Topics\n4. Assessment Methods/Grading\n\nPlease provide a clear, structured text summary of these parts. If some parts are missing, just extract what is available.";
  const systemInstruction = "You are an academic advisor helping students with Erasmus credit transfers. Your task is to extract relevant syllabus information from university documents in any language and provide a concise summary in English.";
  
  return askGemini(prompt, systemInstruction, pdfBase64);
}

export interface AIComparisonResult {
  similarity: number;
  verdict: 'approved' | 'rejected';
  reasoning: string;
  mismatches: string[];
  creditsMatch: boolean;
  typeMatch: boolean;
}

/**
 * Platinum-Standard Comparison: Sends MENDELU data + Foreign PDF to Gemini.
 * It enforces MENDELU's specific academic rules.
 */
export async function compareSyllabiAI(
  mendeluSyllabus: string, 
  mendeluMetadata: { credits: number; type: string; code: string; name: string },
  pdfBase64?: string,
  foreignText?: string
): Promise<AIComparisonResult> {
  const prompt = `
COMPARE THESE TWO COURSE SYLLABI FOR ERASMUS RECOGNITION.

MENDELU COURSE (HOME):
- Code: ${mendeluMetadata.code}
- Name: ${mendeluMetadata.name}
- Credits: ${mendeluMetadata.credits} ECTS
- Type: ${mendeluMetadata.type} (zk = Exam, zap/zak = Credit only)
- Content: ${mendeluSyllabus}

FOREIGN COURSE (CANDIDATE):
${foreignText ? `Text content: ${foreignText}` : 'Please extract content from the attached PDF document.'}

RECOGNITION RULES:
1. Learning Outcomes: Focus on the CORE 60-70% overlap. Do not be overly strict about missing theoretical sub-topics if the main applied topics are present.
2. Credits: Foreign ECTS should ideally be >= Home ECTS. However, a 1-credit deficit (e.g., 5 vs 6) is VERY OFTEN accepted by coordinators and should NOT be a reason for rejection.
3. Type Mismatch: Only reject if there is a massive gap (e.g., a 10-credit Exam course being replaced by a 2-credit workshop).
4. Tone: Be a "Helpful Advisor," not a "Hostile Bureaucrat."

OUTPUT FORMAT (JSON ONLY):
{
  "similarity": 0.0-1.0,
  "verdict": "approved" | "rejected",
  "reasoning": "Krátké, realistické zhodnocení v češtině. Pokud je drobný nesoulad, zmiň, že koordinátor to pravděpodobně uzná.",
  "mismatches": ["seznam věcí k diskusi s koordinátorem"],
  "creditsMatch": true/false,
  "typeMatch": true/false
}
`;

  const systemInstruction = "You are a senior academic advisor at Mendel University in Brno. You are an expert at evaluating syllabus equivalence for Erasmus+ students. You are strict but fair, ensuring MENDELU standards are met while supporting student mobility.";
  
  const responseText = await askGemini(prompt, systemInstruction, pdfBase64);
  
  // Clean up potential markdown JSON wrapping
  const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(jsonStr) as AIComparisonResult;
}
