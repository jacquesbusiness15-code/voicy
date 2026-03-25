import { corsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

const ENDPOINTS: Record<string, string> = {
  transcriptions: "https://api.openai.com/v1/audio/transcriptions",
  chat: "https://api.openai.com/v1/chat/completions",
  embeddings: "https://api.openai.com/v1/embeddings",
  speech: "https://api.openai.com/v1/audio/speech",
  models: "https://api.openai.com/v1/models",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedUser(req);

    const endpoint = req.headers.get("x-endpoint");
    if (!endpoint || !ENDPOINTS[endpoint]) {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstreamUrl = ENDPOINTS[endpoint];

    // Build upstream headers — preserve content-type for FormData (transcriptions)
    const upstreamHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    const contentType = req.headers.get("Content-Type");
    if (contentType && !contentType.includes("multipart/form-data")) {
      // For JSON requests, set content-type explicitly
      upstreamHeaders["Content-Type"] = contentType;
    }
    // For multipart/form-data, let fetch set the boundary automatically
    // by NOT setting Content-Type — the body carries it

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: contentType?.includes("multipart/form-data")
        ? { Authorization: `Bearer ${apiKey}` }
        : upstreamHeaders,
      body: req.method !== "GET" ? req.body : undefined,
    });

    // Return upstream response preserving status and content-type
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error: any) {
    const status = error.message.includes("token") ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
