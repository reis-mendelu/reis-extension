import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const EXTENSION_SECRET = Deno.env.get("EXTENSION_SECRET");
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reis-extension-secret',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in the Edge Function environment");
    }

    // Validate the custom extension secret
    const secretHeader = req.headers.get("x-reis-extension-secret");
    if (EXTENSION_SECRET && secretHeader !== EXTENSION_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid extension secret" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Parse the request from the extension
    const { prompt, systemInstruction, pdfBase64 } = await req.json();

    const body: any = {
      contents: [{
        parts: [
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    if (pdfBase64) {
      body.contents[0].parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: pdfBase64
        }
      });
    }

    if (systemInstruction) {
      body.system_instruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // Forward to Gemini with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json();
      const errorMessage = errorData.error?.message || geminiRes.statusText;
      return new Response(JSON.stringify({ error: `Gemini API Error: ${errorMessage}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: geminiRes.status,
      });
    }

    const data = await geminiRes.json();

    // Return the result back to the extension
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    // Handle the AbortError separately
    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: "Gemini API Timeout" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 504,
      });
    }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
