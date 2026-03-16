import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function buildFullSystemPrompt(systemPrompt: string): string {
  return `${systemPrompt}

=== REGRAS ===
1. Use TODAS as informações acima nas suas respostas. Copie valores literais (links, preços, nomes) EXATAMENTE como estão.
2. NUNCA use placeholders como [INSERIR LINK], [*texto*], {link}, "SEU LINK AQUI" ou qualquer variação.
3. Se não souber algo, dê uma resposta curta e neutra. NUNCA diga "vou verificar", "vou consultar", "já te retorno" ou prometa buscar informações.
4. Responda de forma natural e direta, como numa conversa real de WhatsApp.
5. NÃO repita saudações (olá, oi, tudo bem, bom dia) se a conversa já começou. Vá direto ao ponto.
6. NUNCA formate links com Markdown. NÃO use [texto](url) nem (url). Envie links como texto puro. Ex: https://exemplo.com`;
}

function isOpenAIModel(model: string): boolean {
  return model.startsWith("gpt-");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { flowId, message, history } = await req.json();

    if (!flowId || !message) {
      return new Response(
        JSON.stringify({ error: "flowId and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: flowData, error: flowError } = await supabase
      .from("chatbot_flows")
      .select("config, name")
      .eq("id", flowId)
      .single();

    if (flowError || !flowData) {
      return new Response(
        JSON.stringify({ error: "Flow not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = flowData.config as any;
    const systemPrompt = cfg?.systemPrompt || "Você é um assistente virtual amigável.";
    const model = cfg?.model || "google/gemini-2.5-flash";
    const temperature = cfg?.temperature ?? 0.7;
    const maxTokens = cfg?.maxTokens || 4096;

    const fullPrompt = buildFullSystemPrompt(systemPrompt);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: fullPrompt },
    ];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: message });

    const diagnostics: any = {
      flowName: flowData.name,
      model,
      temperature,
      maxTokens,
      promptLength: systemPrompt.length,
      promptPreview: systemPrompt.substring(0, 300),
      historyCount: history?.length || 0,
      provider: null,
      errors: [],
    };

    console.log("[test-agent] Config:", JSON.stringify({ ...diagnostics, errors: undefined }));

    let aiResponse = "";

    // 1. Try Google AI (for non-GPT models)
    if (!isOpenAIModel(model)) {
      const { data: googleKeySetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "google_ai_api_key")
        .maybeSingle();

      if (googleKeySetting?.value) {
        const googleModel = model.replace(/^google\//, "");
        const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
        for (const msg of messages.slice(1)) {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          });
        }

        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleKeySetting.value}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents,
                systemInstruction: { parts: [{ text: fullPrompt }] },
                generationConfig: { temperature, maxOutputTokens: maxTokens },
              }),
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (aiResponse) diagnostics.provider = "google";
          } else {
            const errBody = await resp.text();
            console.error("[test-agent] Google AI error:", resp.status, errBody);
            diagnostics.errors.push(`Google AI: ${resp.status} - ${errBody.substring(0, 200)}`);
          }
        } catch (e) {
          console.error("[test-agent] Google AI fetch error:", e);
          diagnostics.errors.push(`Google AI fetch: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        diagnostics.errors.push("Google AI: chave não configurada");
      }
    }

    // 2. Try OpenAI (for GPT models OR as fallback)
    if (!aiResponse) {
      const { data: openaiKeySetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "openai_api_key")
        .maybeSingle();

      if (openaiKeySetting?.value) {
        const openaiModel = isOpenAIModel(model) ? model : "gpt-4o-mini";
        try {
          const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiKeySetting.value}`,
            },
            body: JSON.stringify({
              model: openaiModel,
              messages,
              temperature,
              max_tokens: maxTokens,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            aiResponse = data.choices?.[0]?.message?.content || "";
            if (aiResponse) diagnostics.provider = "openai";
          } else {
            const errBody = await resp.text();
            console.error("[test-agent] OpenAI error:", resp.status, errBody);
            diagnostics.errors.push(`OpenAI: ${resp.status} - ${errBody.substring(0, 200)}`);
          }
        } catch (e) {
          console.error("[test-agent] OpenAI fetch error:", e);
          diagnostics.errors.push(`OpenAI fetch: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        diagnostics.errors.push("OpenAI: chave não configurada");
      }
    }

    // 3. Fallback: Lovable AI Gateway
    if (!aiResponse) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: model || "google/gemini-2.5-flash",
              messages,
              temperature,
              max_tokens: maxTokens,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            aiResponse = data.choices?.[0]?.message?.content || "";
            if (aiResponse) diagnostics.provider = "lovable";
          } else {
            const errBody = await resp.text();
            console.error("[test-agent] Lovable AI error:", resp.status, errBody);
            diagnostics.errors.push(`Lovable AI: ${resp.status} - ${errBody.substring(0, 200)}`);
          }
        } catch (e) {
          console.error("[test-agent] Lovable AI fetch error:", e);
          diagnostics.errors.push(`Lovable AI fetch: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        diagnostics.errors.push("Lovable AI: LOVABLE_API_KEY não configurada");
      }
    }

    if (!aiResponse) {
      aiResponse = "Nenhum provedor de IA disponível. Erros: " + diagnostics.errors.join(" | ");
    }

    return new Response(
      JSON.stringify({ response: aiResponse, diagnostics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[test-agent] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;
if (import.meta.main) Deno.serve(handler);
