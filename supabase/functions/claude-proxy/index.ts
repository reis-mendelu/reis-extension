// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// @ts-ignore
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// @ts-ignore
const EXTENSION_SECRET = Deno.env.get("EXTENSION_SECRET");
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reis-extension-secret',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set in the Edge Function environment");
    }

    const secretHeader = req.headers.get("x-reis-extension-secret");
    if (EXTENSION_SECRET && secretHeader !== EXTENSION_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid extension secret" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { prompt, systemInstruction, pdfBase64, foreignText } = await req.json();

    const userContent: any[] = [];

    if (pdfBase64) {
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
      });
    }

    if (foreignText) {
      userContent.push({ type: "text", text: `Foreign course syllabus text:\n\n${foreignText}` });
    }

    userContent.push({ type: "text", text: prompt });

    const body: any = {
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
    };

    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const claudeRes = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!claudeRes.ok) {
      const errorData = await claudeRes.json();
      const errorMessage = errorData.error?.message || claudeRes.statusText;
      return new Response(JSON.stringify({ error: `Claude API Error: ${errorMessage}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: claudeRes.status,
      });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text ?? '';

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: "Claude API Timeout" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 504,
      });
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
