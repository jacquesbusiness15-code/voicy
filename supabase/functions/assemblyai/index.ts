import { corsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedUser(req);

    const apiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AssemblyAI API key not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = req.headers.get("x-endpoint") ?? "";
    let upstreamUrl: string;
    let upstreamHeaders: Record<string, string> = { Authorization: apiKey };

    if (endpoint === "upload") {
      upstreamUrl = "https://api.assemblyai.com/v2/upload";
      upstreamHeaders["Content-Type"] = "application/octet-stream";
    } else if (endpoint === "transcribe") {
      upstreamUrl = "https://api.assemblyai.com/v2/transcript";
      upstreamHeaders["Content-Type"] = "application/json";
    } else if (endpoint.startsWith("poll/")) {
      const transcriptId = endpoint.replace("poll/", "");
      upstreamUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: req.method !== "GET" ? req.body : undefined,
    });

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
