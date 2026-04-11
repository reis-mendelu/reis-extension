import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Parse the request from the extension
    const { prompt, systemInstruction, pdfBase64 } = await req.json();

    const body: any = {
      contents: [{
        parts: [
          { text: prompt }
        ]
      }]
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

    // Forward to Gemini
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json();
      throw new Error(`Gemini API Error: ${errorData.error?.message || geminiRes.statusText}`);
    }

    const data = await geminiRes.json();

    // Return the result back to the extension
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
