const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  verify:
    `Analise esta foto com MÁXIMO RIGOR. Existe um outdoor ou painel publicitário GRANDE, NÍTIDO e BEM CENTRALIZADO? Se SIM, diga também a qualidade: OTIMO (centralizado e grande), BOM (visível mas lateral), RUIM (pequeno ou distante). Responda APENAS em um destes formatos: SIM-OTIMO, SIM-BOM, SIM-RUIM ou NAO.`,
  zoom:
    "Avalie o enquadramento do outdoor/painel publicitário nesta foto. Está bem visível e centralizado? Responda APENAS com uma palavra: OTIMO, BOM ou RUIM.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { task, image } = await req.json();
    const prompt = PROMPTS[task as string];
    if (!prompt || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Invalid task or image" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted" }), {
        status: 402,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: text || "ai_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await res.json();
    const answer = (data?.choices?.[0]?.message?.content ?? "").toString().toUpperCase().trim();
    return new Response(JSON.stringify({ answer }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});