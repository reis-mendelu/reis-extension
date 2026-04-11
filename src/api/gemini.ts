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

/**
 * Standard "Hello World" test for Gemini API.
 */
export async function testGeminiConnection(): Promise<string> {
  return askGemini("Say 'Hello World from reIS! (via Supabase Proxy)'");
}

/**
 * Sends a prompt with optional system instruction to Gemini via Supabase proxy.
 */
export async function askGemini(prompt: string, systemInstruction?: string, pdfBase64?: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration (URL or Anon Key) is missing in .env');
  }

  const response = await fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ prompt, systemInstruction, pdfBase64 })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Proxy Error: ${response.statusText}`);
  }

  const data: GeminiResponse = await response.json();
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response format from Gemini');
  }

  return data.candidates[0].content.parts[0].text;
}
