import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source_id: string;
  target_id: string;
  label?: string;
}

interface FlowState {
  currentNodeId: string;
  awaitingMenuResponse: boolean;
  menuOptions?: Array<{ id: string; text: string }>;
  menuTitle?: string;
  flowId: string;
  awaitingAIResponse?: boolean;
  aiNodeData?: {
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    knowledgeBase?: string;
    useOwnApiKey?: boolean;
    googleApiKey?: string;
  };
  awaitingScheduleResponse?: boolean;
  scheduleNodeData?: {
    integrationId: string;
    calendarId: string;
    availableSlots: Array<{ start: string; end: string }>;
    eventTitle?: string;
    eventDescription?: string;
    eventDuration?: number;
    sendConfirmation?: boolean;
  };
}

// Baileys server configuration (loaded once per execution)
interface BaileysConfig {
  serverUrl: string;
  apiKey: string;
  sessionName: string;
}

// Split AI responses into 2-3 human-like message chunks
// Simulates natural human typing by splitting into multiple messages
function splitLongMessage(text: string, _maxLength = 4000): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [trimmed];

  // Very short messages (greetings, confirmations) — send as-is
  if (trimmed.length < 150) return [trimmed];

  // Step 1: Try splitting by double newlines (paragraphs)
  let segments = trimmed.split(/\n\n+/).filter(p => p.trim());

  // Step 2: If only 1 segment, try single newlines
  if (segments.length <= 1) {
    segments = trimmed.split(/\n/).filter(p => p.trim());
  }

  // Step 3: If still 1 segment, split by sentences
  if (segments.length <= 1) {
    const sentences = trimmed.match(/[^.!?]+[.!?]+[\s]*/g);
    if (sentences && sentences.length >= 2) {
      segments = sentences.map(s => s.trim()).filter(s => s);
    } else {
      return [trimmed]; // Can't split meaningfully
    }
  }

  // Determine target chunks: 150-600 chars → 2, 600+ → 3
  const targetChunks = trimmed.length > 600 && segments.length >= 3 ? 3 : 2;

  // Distribute segments into balanced chunks
  const chunks: string[] = [];
  const segPerChunk = Math.ceil(segments.length / targetChunks);

  for (let i = 0; i < targetChunks; i++) {
    const start = i * segPerChunk;
    const end = Math.min(start + segPerChunk, segments.length);
    if (start >= segments.length) break;
    const separator = trimmed.includes("\n\n") ? "\n\n" : "\n";
    const chunk = segments.slice(start, end).join(separator).trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks : [trimmed];
}

// Calculates a human-like typing delay based on chunk size
function humanTypingDelay(chunk: string): number {
  return Math.min(chunk.length * 15, 2000) + 800 + Math.random() * 1500;
}

// Load Baileys config from system_settings
async function loadBaileysConfig(supabase: any, connection: any): Promise<BaileysConfig | null> {
  const { data: urlSetting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "baileys_server_url")
    .single();

  const { data: keySetting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "baileys_api_key")
    .single();

  const serverUrl = urlSetting?.value;
  const apiKey = keySetting?.value;

  if (!serverUrl) {
    console.error("[FlowExecutor] Baileys server URL not configured in system_settings");
    return null;
  }

  const sessionData = connection.session_data as Record<string, unknown> | null;
  const sessionName = (sessionData?.sessionName as string) || connection.name.toLowerCase().replace(/\s+/g, "_");

  return { serverUrl, apiKey, sessionName };
}

// Send typing presence ("composing...") before each message
async function sendTypingPresence(config: BaileysConfig, phone: string) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["X-API-Key"] = config.apiKey;
    await fetch(`${config.serverUrl}/sessions/${config.sessionName}/presence`, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: phone, presence: "composing" }),
    });
  } catch (_e) { /* silently ignore */ }
}

// Send WhatsApp message through Baileys API
async function sendWhatsAppMessage(
  config: BaileysConfig,
  phone: string,
  content: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["X-API-Key"] = config.apiKey;
    }

    let response;

    if (mediaUrl && mediaType && mediaType !== "text") {
      response = await fetch(`${config.serverUrl}/sessions/${config.sessionName}/send/media`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: phone,
          mediaUrl,
          caption: content,
          mediaType,
        }),
      });
    } else {
      response = await fetch(`${config.serverUrl}/sessions/${config.sessionName}/send/text`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: phone,
          text: content,
        }),
      });
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("[FlowExecutor] Failed to send message:", JSON.stringify(result));
      return false;
    }

    console.log("[FlowExecutor] Message sent successfully");
    return true;
  } catch (error) {
    console.error("[FlowExecutor] Error sending message:", error);
    return false;
  }
}

// Message history type
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Patterns that indicate a contaminated bot response (placeholders, templates)
const CONTAMINATED_PATTERNS = [
  /\[\*.*?\*\]/,           // [*INSERIR LINK*], [*texto*]
  /\[INSERIR/i,            // [INSERIR ...]
  /INSERIR\s+(AQUI|LINK|URL|PREÇO|VALOR|NOME)/i,
  /substituir\s+este\s+texto/i,
  /\{(link|url|preco|valor|nome|produto|site)\}/i, // {link}, {url}
  /SEU[\s_]+(LINK|SITE|URL)/i,
  /coloque\s+aqui/i,
];

function isContaminatedMessage(content: string): boolean {
  return CONTAMINATED_PATTERNS.some(pattern => pattern.test(content));
}

// Fetch conversation history for AI context — sanitized
async function fetchConversationHistory(
  supabase: any,
  conversationId: string,
  maxMessages: number = 10
): Promise<ChatMessage[]> {
  try {
    const { data: messages, error } = await supabase
      .from("messages")
      .select("content, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(maxMessages);

    if (error || !messages) {
      console.error("[FlowExecutor] Error fetching history:", error);
      return [];
    }

    const history: ChatMessage[] = messages
      .reverse()
      .filter((msg: any) => {
        // Keep all user messages; filter out contaminated bot messages
        if (msg.sender_type === "contact") return true;
        return !isContaminatedMessage(msg.content || "");
      })
      .map((msg: any) => ({
        role: msg.sender_type === "contact" ? "user" : "assistant",
        content: msg.content,
      }));

    console.log(`[FlowExecutor] Loaded ${history.length} messages for context (filtered from ${messages.length})`);
    return history;
  } catch (error) {
    console.error("[FlowExecutor] Error in fetchConversationHistory:", error);
    return [];
  }
}

// Build the full system prompt, merging knowledge base into the prompt if present
function buildFullSystemPrompt(systemPrompt: string, knowledgeBase?: string): string {
  const basePrompt = knowledgeBase 
    ? `${systemPrompt}\n\n=== INFORMAÇÕES DA EMPRESA (use EXATAMENTE como escritas) ===\n${knowledgeBase}\n=== FIM DAS INFORMAÇÕES ===`
    : systemPrompt;

  return `${basePrompt}

=== REGRAS ===
1. Use TODAS as informações acima nas suas respostas. Copie valores literais (links, preços, nomes) EXATAMENTE como estão.
2. NUNCA use placeholders como [INSERIR LINK], [*texto*], {link}, "SEU LINK AQUI" ou qualquer variação.
3. Se não souber algo, dê uma resposta curta e neutra. NUNCA diga "vou verificar", "vou consultar", "já te retorno" ou prometa buscar informações.
4. Responda de forma natural e direta, como numa conversa real de WhatsApp.`;
}

// Call Google AI Studio API directly (for user's own API key)
async function callGoogleAI(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  model: string,
  temperature: number,
  maxTokens: number,
  knowledgeBase?: string,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  const fullSystemPrompt = buildFullSystemPrompt(systemPrompt, knowledgeBase);

  try {
    console.log("[FlowExecutor] Calling Google AI Studio with model:", model);
    
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
    }
    
    contents.push({ role: "user", parts: [{ text: userMessage }] });
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: fullSystemPrompt }] },
          generationConfig: {
            temperature: temperature || 0.7,
            maxOutputTokens: model.includes("2.5") ? Math.max(maxTokens || 4096, 8192) : (maxTokens || 4096),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FlowExecutor] Google AI error:", errorText);
      return "Desculpe, ocorreu um erro ao processar sua mensagem.";
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    console.log(`[FlowExecutor] Google AI response: ${candidate?.content?.parts?.[0]?.text?.length || 0} chars, finishReason: ${candidate?.finishReason}, model: ${model}`);
    return candidate?.content?.parts?.[0]?.text || "Não consegui gerar uma resposta.";
  } catch (error) {
    console.error("[FlowExecutor] Error calling Google AI:", error);
    return "Desculpe, ocorreu um erro ao processar sua mensagem.";
  }
}

// Call AI model via Lovable AI Gateway
async function callLovableAI(
  systemPrompt: string,
  userMessage: string,
  model: string,
  temperature: number,
  maxTokens: number,
  knowledgeBase?: string,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    console.error("[FlowExecutor] LOVABLE_API_KEY not configured");
    return "Desculpe, não foi possível processar sua mensagem.";
  }

  const fullSystemPrompt = buildFullSystemPrompt(systemPrompt, knowledgeBase);

  try {
    console.log("[FlowExecutor] Calling Lovable AI with model:", model);
    
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];
    
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    
    messages.push({ role: "user", content: userMessage });
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-flash",
        messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      console.error("[FlowExecutor] AI API error:", await response.text());
      return "Desculpe, ocorreu um erro ao processar sua mensagem.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";
  } catch (error) {
    console.error("[FlowExecutor] Error calling AI:", error);
    return "Desculpe, ocorreu um erro ao processar sua mensagem.";
  }
}

// Auto-tag conversation using AI classification
async function autoTagConversation(
  supabase: any,
  conversationId: string,
  messageContent: string,
  aiResponse: string
): Promise<void> {
  try {
    // Check if auto-tagging is enabled
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "auto_tag_enabled")
      .maybeSingle();

    if (setting?.value === "false") {
      console.log("[FlowExecutor] Auto-tagging disabled");
      return;
    }

    // Fetch existing tags
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id, name, description");

    if (tagsError || !tags || tags.length === 0) {
      console.log("[FlowExecutor] No tags found for auto-tagging");
      return;
    }

    const tagList = tags.map((t: any) => `- ${t.name}${t.description ? ` (${t.description})` : ""}`).join("\n");
    const classifyPrompt = `Você é um classificador de conversas. Analise a mensagem do cliente e a resposta do atendente/bot e retorne APENAS os nomes das tags aplicáveis da lista abaixo, separados por vírgula. Se nenhuma tag se aplicar, retorne "NENHUMA".\n\nTags disponíveis:\n${tagList}`;
    const classifyUserMsg = `Mensagem do cliente: ${messageContent}\n\nResposta do bot: ${aiResponse}`;

    // Try Lovable AI Gateway first, then fallback to Google/OpenAI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let classifyResponse: Response;
    
    if (lovableApiKey) {
      classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: classifyPrompt },
            { role: "user", content: classifyUserMsg },
          ],
          temperature: 0.1,
          max_tokens: 200,
        }),
      });
    } else {
      // Try OpenAI first if key exists
      const openaiKey = await getOpenAIApiKeyFromDB(supabase);
      if (openaiKey) {
        classifyResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: classifyPrompt },
              { role: "user", content: classifyUserMsg },
            ],
            temperature: 0.1,
            max_tokens: 200,
          }),
        });
      } else {
        // Fallback to Google AI
        const googleKey = await getGoogleApiKeyFromDB(supabase);
        if (!googleKey) return;
        
        classifyResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${googleKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: classifyUserMsg }] }],
              systemInstruction: { parts: [{ text: classifyPrompt }] },
              generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
            }),
          }
        );
      }
    }

    if (!classifyResponse.ok) {
      console.error("[FlowExecutor] Auto-tag AI error:", classifyResponse.status);
      return;
    }

    const classifyData = await classifyResponse.json();
    // Handle both Lovable gateway format and Google API format
    const result = (classifyData.choices?.[0]?.message?.content || classifyData.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

    if (!result || result === "NENHUMA") return;

    const tagNames = result.split(",").map((t: string) => t.trim().toLowerCase());
    const matchedTags = tags.filter((t: any) => tagNames.includes(t.name.toLowerCase()));

    if (matchedTags.length === 0) return;

    console.log(`[FlowExecutor] Auto-tagging conversation ${conversationId} with: ${matchedTags.map((t: any) => t.name).join(", ")}`);

    // Insert tags (ON CONFLICT DO NOTHING thanks to unique constraint)
    for (const tag of matchedTags) {
      await supabase
        .from("conversation_tags")
        .upsert(
          { conversation_id: conversationId, tag_id: tag.id },
          { onConflict: "conversation_id,tag_id" }
        );
    }
  } catch (err) {
    console.error("[FlowExecutor] Auto-tag error (non-critical):", err);
  }
}

// Helper to get Google AI API key from system_settings
async function getGoogleApiKeyFromDB(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "google_ai_api_key")
      .maybeSingle();
    return data?.value || null;
  } catch { return null; }
}

// Helper to get OpenAI API key from system_settings
async function getOpenAIApiKeyFromDB(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "openai_api_key")
      .maybeSingle();
    return data?.value || null;
  } catch { return null; }
}

// Map gateway model names to Google API model names
function normalizeModelName(model: string): string {
  return model.replace(/^google\//, "");
}

// Check if model is OpenAI
function isOpenAIModel(model: string): boolean {
  return model.startsWith("gpt-");
}

// Download media from Baileys server directly (fallback when mediaUrl is null)
async function downloadMediaFromBaileys(
  supabase: any,
  baileysMessageId: string,
  sessionName: string
): Promise<{ base64: string; contentType: string } | null> {
  try {
    const { data: urlSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "baileys_server_url")
      .single();

    if (!urlSetting?.value) {
      console.log("[FlowExecutor] No baileys_server_url configured");
      return null;
    }

    const { data: keySetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "baileys_api_key")
      .single();

    const baileysUrl = urlSetting.value.replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (keySetting?.value) headers["X-API-Key"] = keySetting.value;

    const url = `${baileysUrl}/sessions/${sessionName}/messages/${baileysMessageId}/media`;
    console.log(`[FlowExecutor] Downloading media directly from Baileys: ${url}`);

    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      console.warn(`[FlowExecutor] Baileys direct download failed: ${response.status}`);
      return null;
    }

    const respCT = response.headers.get("content-type") || "";

    if (respCT.includes("application/json")) {
      const json = await response.json();
      // Support both { base64, mimetype } and { data: { base64, mimetype } }
      const b64 = json.data?.base64 || json.base64;
      const mime = json.data?.mimetype || json.mimetype;
      if (!b64) {
        console.warn("[FlowExecutor] Baileys JSON response has no base64. Keys:", Object.keys(json));
        return null;
      }
      return { base64: b64, contentType: mime || "application/octet-stream" };
    } else {
      const arrayBuf = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      if (bytes.length === 0) return null;
      // Convert binary to base64
      let binaryStr = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binaryStr += String.fromCharCode(...chunk);
      }
      return { base64: btoa(binaryStr), contentType: respCT.split(";")[0].trim() || "application/octet-stream" };
    }
  } catch (err) {
    console.error("[FlowExecutor] Baileys direct download error:", err);
    return null;
  }
}

// Download media from storage or Baileys and return base64
async function getMediaBase64(
  mediaUrl: string | null,
  baileysMessageId: string | null,
  sessionName: string,
  supabaseClient: any
): Promise<{ base64: string; contentType: string } | null> {
  // Try storage first
  if (mediaUrl) {
    let storagePath = "";
    if (mediaUrl.includes("/storage/v1/object/public/whatsapp-media/")) {
      storagePath = mediaUrl.split("/storage/v1/object/public/whatsapp-media/")[1];
    } else if (mediaUrl.startsWith("/storage/")) {
      const match = mediaUrl.match(/whatsapp-media\/(.+)$/);
      storagePath = match ? match[1] : "";
    }

    if (storagePath && supabaseClient) {
      console.log(`[FlowExecutor] Downloading media from storage path: ${storagePath}`);
      const { data: fileData, error: dlError } = await supabaseClient.storage
        .from("whatsapp-media")
        .download(storagePath);

      if (!dlError && fileData) {
        const bytes = new Uint8Array(await fileData.arrayBuffer());
        let binaryStr = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binaryStr += String.fromCharCode(...chunk);
        }
        return { base64: btoa(binaryStr), contentType: fileData.type || "application/octet-stream" };
      }
      console.warn("[FlowExecutor] Storage download failed:", dlError?.message);
    }
  }

  // Fallback: download from Baileys
  if (baileysMessageId) {
    return await downloadMediaFromBaileys(supabaseClient, baileysMessageId, sessionName);
  }

  return null;
}

// Describe image using Gemini multimodal API
async function describeImage(base64Image: string, contentType: string, supabaseClient: any): Promise<string> {
  const fallbackText = "[O contato enviou uma imagem que não pôde ser analisada. Peça gentilmente que descreva o conteúdo da imagem em texto.]";
  try {
    // Try Google AI key from system_settings first
    const googleKey = await getGoogleApiKeyFromDB(supabaseClient);

    if (googleKey) {
      console.log("[FlowExecutor] Describing image with Google AI (direct key)");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { inlineData: { mimeType: contentType, data: base64Image } },
                { text: "Descreva objetivamente e de forma concisa o conteúdo desta imagem. Inclua textos visíveis, objetos, pessoas e contexto relevante. Retorne APENAS a descrição, sem comentários adicionais." },
              ],
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const description = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (description) return description.trim();
      } else {
        console.error("[FlowExecutor] Google AI image description error:", response.status);
      }
    }

    // Fallback: Lovable AI Gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableApiKey) {
      console.log("[FlowExecutor] Describing image with Lovable AI Gateway");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Descreva objetivamente e de forma concisa o conteúdo desta imagem. Inclua textos visíveis, objetos, pessoas e contexto relevante. Retorne APENAS a descrição." },
              { type: "image_url", image_url: { url: `data:${contentType};base64,${base64Image}` } },
            ],
          }],
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const description = data.choices?.[0]?.message?.content;
        if (description) return description.trim();
      } else {
        console.error("[FlowExecutor] Lovable AI image description error:", response.status);
      }
    }

    return fallbackText;
  } catch (error) {
    console.error("[FlowExecutor] Image description error:", error);
    return fallbackText;
  }
}

// Transcribe audio using Google Gemini multimodal API
async function transcribeAudio(mediaUrl: string | null, requestBody: any, supabaseClient?: any): Promise<string> {
  const fallbackText = "[O contato enviou um áudio. Peça gentilmente que repita a mensagem em texto, explicando que você precisa da mensagem escrita para poder ajudar melhor.]";
  try {
    let base64Audio = "";
    let contentType = "audio/ogg";

    // If we already have base64 from Baileys direct download
    if (requestBody._audioBase64) {
      console.log("[FlowExecutor] Using pre-downloaded audio base64");
      base64Audio = requestBody._audioBase64;
      contentType = requestBody._audioContentType || "audio/ogg";
    } else if (mediaUrl) {
      // Download from storage using authenticated request
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Extract storage path from URL
      let storagePath = "";
      if (mediaUrl.includes("/storage/v1/object/public/whatsapp-media/")) {
        storagePath = mediaUrl.split("/storage/v1/object/public/whatsapp-media/")[1];
      } else if (mediaUrl.startsWith("/storage/")) {
        // Relative path like /storage/v1/object/public/whatsapp-media/session/file.ogg
        const match = mediaUrl.match(/whatsapp-media\/(.+)$/);
        storagePath = match ? match[1] : "";
      }

      if (storagePath && supabaseClient) {
        // Use Supabase client to download (works inside Docker)
        console.log(`[FlowExecutor] Downloading audio from storage path: ${storagePath}`);
        const { data: fileData, error: dlError } = await supabaseClient.storage
          .from("whatsapp-media")
          .download(storagePath);

        if (dlError || !fileData) {
          console.error("[FlowExecutor] Storage download failed:", dlError?.message);
          // Fallback: try direct URL
          const fullUrl = mediaUrl.startsWith("http") ? mediaUrl : `${supabaseUrl}${mediaUrl}`;
          console.log("[FlowExecutor] Falling back to direct URL:", fullUrl);
          const audioResponse = await fetch(fullUrl, {
            headers: { "Authorization": `Bearer ${serviceKey}` },
          });
          if (!audioResponse.ok) {
            console.error("[FlowExecutor] Direct URL download also failed:", audioResponse.status);
            return fallbackText;
          }
          const audioBlob = await audioResponse.arrayBuffer();
          const audioBytes = new Uint8Array(audioBlob);
          const chunkSize = 8192;
          let binaryStr = "";
          for (let i = 0; i < audioBytes.length; i += chunkSize) {
            const chunk = audioBytes.subarray(i, i + chunkSize);
            binaryStr += String.fromCharCode(...chunk);
          }
          base64Audio = btoa(binaryStr);
          contentType = audioResponse.headers.get("content-type") || "audio/ogg";
        } else {
          // fileData is a Blob
          const audioBytes = new Uint8Array(await fileData.arrayBuffer());
          const chunkSize = 8192;
          let binaryStr = "";
          for (let i = 0; i < audioBytes.length; i += chunkSize) {
            const chunk = audioBytes.subarray(i, i + chunkSize);
            binaryStr += String.fromCharCode(...chunk);
          }
          base64Audio = btoa(binaryStr);
          contentType = fileData.type || "audio/ogg";
          console.log(`[FlowExecutor] Audio downloaded from storage: ${audioBytes.length} bytes, type: ${contentType}`);
        }
      } else {
        // No storage path extracted, try full URL
        const fullUrl = mediaUrl.startsWith("http") ? mediaUrl : `${supabaseUrl}${mediaUrl}`;
        console.log("[FlowExecutor] Downloading audio from URL:", fullUrl);
        const audioResponse = await fetch(fullUrl);
        if (!audioResponse.ok) {
          console.error("[FlowExecutor] Failed to download audio:", audioResponse.status);
          return fallbackText;
        }
        const audioBlob = await audioResponse.arrayBuffer();
        const audioBytes = new Uint8Array(audioBlob);
        const chunkSize = 8192;
        let binaryStr = "";
        for (let i = 0; i < audioBytes.length; i += chunkSize) {
          const chunk = audioBytes.subarray(i, i + chunkSize);
          binaryStr += String.fromCharCode(...chunk);
        }
        base64Audio = btoa(binaryStr);
        contentType = audioResponse.headers.get("content-type") || "audio/ogg";
      }
    } else {
      console.error("[FlowExecutor] No mediaUrl and no pre-downloaded audio");
      return fallbackText;
    }

    if (!base64Audio) {
      console.error("[FlowExecutor] Could not obtain audio data");
      return fallbackText;
    }

    console.log(`[FlowExecutor] Audio ready for transcription: ${base64Audio.length} base64 chars, type: ${contentType}`);

    // Try Google AI key from system_settings first
    const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = supabaseClient || (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(supabaseUrl2, supabaseKey2);
    
    const googleKey = await getGoogleApiKeyFromDB(supabase);

    if (googleKey) {
      console.log("[FlowExecutor] Transcribing audio with Google AI (direct key)");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: contentType,
                    data: base64Audio,
                  },
                },
                { text: "Transcreva o conteúdo deste áudio em texto. Retorne APENAS a transcrição, sem comentários adicionais." },
              ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (transcription) {
          return `[Transcrição do áudio]: ${transcription.trim()}`;
        }
      } else {
        console.error("[FlowExecutor] Google AI transcription error:", response.status, await response.text());
      }
    }

    // Fallback: Lovable AI Gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableApiKey) {
      console.log("[FlowExecutor] Transcribing audio with Lovable AI Gateway");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Transcreva o conteúdo deste áudio em texto. Retorne APENAS a transcrição, sem comentários adicionais." },
              { type: "input_audio", input_audio: { data: base64Audio, format: contentType.includes("ogg") ? "ogg" : "mp3" } },
            ],
          }],
          temperature: 0.1,
          max_tokens: 2048,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const transcription = data.choices?.[0]?.message?.content;
        if (transcription) {
          return `[Transcrição do áudio]: ${transcription.trim()}`;
        }
      } else {
        console.error("[FlowExecutor] Lovable AI transcription error:", response.status);
      }
    }

    console.warn("[FlowExecutor] No AI provider available for transcription");
    return fallbackText;
  } catch (error) {
    console.error("[FlowExecutor] Audio transcription error:", error);
    return fallbackText;
  }
}

// Call OpenAI API directly
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  model: string,
  temperature: number,
  maxTokens: number,
  knowledgeBase?: string,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  const fullPrompt = buildFullSystemPrompt(systemPrompt, knowledgeBase);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: fullPrompt },
  ];

  if (conversationHistory) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.sender_type === "contact" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  messages.push({ role: "user", content: userMessage });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[FlowExecutor] OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Unified AI caller that routes to the appropriate API
async function callAI(
  systemPrompt: string,
  userMessage: string,
  model: string,
  temperature: number,
  maxTokens: number,
  knowledgeBase?: string,
  useOwnApiKey?: boolean,
  googleApiKey?: string,
  conversationHistory?: ChatMessage[],
  supabase?: any
): Promise<string> {
  // If explicitly using own Google key
  if (useOwnApiKey && googleApiKey && !isOpenAIModel(model)) {
    return callGoogleAI(googleApiKey, systemPrompt, userMessage, normalizeModelName(model), temperature, maxTokens, knowledgeBase, conversationHistory);
  }
  
  // If OpenAI model, route to OpenAI
  if (isOpenAIModel(model) && supabase) {
    const openaiKey = await getOpenAIApiKeyFromDB(supabase);
    if (openaiKey) {
      console.log("[FlowExecutor] Using OpenAI API for model:", model);
      return callOpenAI(openaiKey, systemPrompt, userMessage, model, temperature, maxTokens, knowledgeBase, conversationHistory);
    }
    console.error("[FlowExecutor] OpenAI model selected but no openai_api_key configured");
    return "Desculpe, a chave da API OpenAI não está configurada. Acesse Configurações > Opções para configurar.";
  }

  // First, try own API keys from system_settings (priority for VPS installs)
  if (supabase && !isOpenAIModel(model)) {
    const dbKey = await getGoogleApiKeyFromDB(supabase);
    if (dbKey) {
      console.log("[FlowExecutor] Using Google AI API key from system_settings");
      return callGoogleAI(dbKey, systemPrompt, userMessage, normalizeModelName(model), temperature, maxTokens, knowledgeBase, conversationHistory);
    }
  }

  // Fallback: Try Lovable AI Gateway
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableApiKey) {
    return callLovableAI(systemPrompt, userMessage, model, temperature, maxTokens, knowledgeBase, conversationHistory);
  }
  
  console.error("[FlowExecutor] No AI API key available. Configure google_ai_api_key in Configurações > Opções.");
  return "Desculpe, não foi possível processar sua mensagem. Configure a chave da API nas configurações (Configurações > Opções).";
}

// Get the next node following an edge
function getNextNode(nodes: FlowNode[], edges: FlowEdge[], currentNodeId: string, optionId?: string): FlowNode | null {
  const edge = edges.find(e => {
    if (optionId) {
      return e.source_id === currentNodeId && e.label === optionId;
    }
    return e.source_id === currentNodeId;
  });

  if (!edge) return null;
  return nodes.find(n => n.id === edge.target_id) || null;
}

// Evaluate condition based on contact/conversation data
async function evaluateCondition(
  supabase: any,
  nodeData: Record<string, unknown>,
  conversationId: string,
  contactId: string,
  messageContent: string,
  contactName: string,
  contactPhone: string
): Promise<boolean> {
  const conditionType = nodeData.conditionType as string || "message";
  
  console.log("[FlowExecutor] Evaluating condition:", conditionType, nodeData);

  switch (conditionType) {
    case "tag": {
      const tagId = nodeData.tagId as string;
      if (!tagId) return false;
      
      const { data: contactTag, error } = await supabase
        .from("contact_tags")
        .select("id")
        .eq("contact_id", contactId)
        .eq("tag_id", tagId)
        .maybeSingle();
      
      if (error) {
        console.error("[FlowExecutor] Error checking tag:", error);
        return false;
      }
      
      return !!contactTag;
    }
    
    case "kanban": {
      const kanbanColumnId = nodeData.kanbanColumnId as string;
      if (!kanbanColumnId) return false;
      
      const { data: conversation, error } = await supabase
        .from("conversations")
        .select("kanban_column_id")
        .eq("id", conversationId)
        .single();
      
      if (error) return false;
      return conversation?.kanban_column_id === kanbanColumnId;
    }

    case "business_hours": {
      const startTime = nodeData.startTime as string || "09:00";
      const endTime = nodeData.endTime as string || "18:00";
      
      const now = new Date();
      const brasilOffset = -3 * 60;
      const localTime = new Date(now.getTime() + (brasilOffset + now.getTimezoneOffset()) * 60000);
      
      const currentHours = localTime.getHours();
      const currentMinutes = localTime.getMinutes();
      const currentTimeMinutes = currentHours * 60 + currentMinutes;
      
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      const [endHours, endMinutes] = endTime.split(":").map(Number);
      
      const startTimeMinutes = startHours * 60 + startMinutes;
      const endTimeMinutes = endHours * 60 + endMinutes;
      
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    }

    case "day_of_week": {
      const daysOfWeek = nodeData.daysOfWeek as string[] || [];
      if (daysOfWeek.length === 0) return false;
      
      const now = new Date();
      const brasilOffset = -3 * 60;
      const localTime = new Date(now.getTime() + (brasilOffset + now.getTimezoneOffset()) * 60000);
      
      const currentDay = localTime.getDay().toString();
      return daysOfWeek.includes(currentDay);
    }

    case "message_count": {
      const messageCount = nodeData.messageCount as number || 0;
      const messageOperator = nodeData.messageOperator as string || "greater";
      
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);
      
      if (error) return false;
      
      const actualCount = count || 0;
      
      switch (messageOperator) {
        case "greater": return actualCount > messageCount;
        case "less": return actualCount < messageCount;
        case "equals": return actualCount === messageCount;
        case "greater_equals": return actualCount >= messageCount;
        case "less_equals": return actualCount <= messageCount;
        default: return actualCount > messageCount;
      }
    }
    
    case "message":
    default: {
      const field = nodeData.field as string || "message";
      const operator = nodeData.operator as string || "contains";
      const value = (nodeData.value as string || "").toLowerCase();
      
      let fieldValue = "";
      switch (field) {
        case "message": fieldValue = messageContent.toLowerCase(); break;
        case "contact_name": fieldValue = (contactName || "").toLowerCase(); break;
        case "contact_phone": fieldValue = (contactPhone || "").toLowerCase(); break;
        default: fieldValue = messageContent.toLowerCase();
      }
      
      switch (operator) {
        case "contains": return fieldValue.includes(value);
        case "equals": return fieldValue === value;
        case "not_equals": return fieldValue !== value;
        case "starts_with": return fieldValue.startsWith(value);
        case "ends_with": return fieldValue.endsWith(value);
        default: return fieldValue.includes(value);
      }
    }
  }
}

// Find the trigger node that matches the message
function findMatchingTrigger(
  nodes: FlowNode[], 
  edges: FlowEdge[], 
  message: string, 
  isNewConversation: boolean,
  connectionId?: string
): FlowNode | null {
  const triggers = nodes.filter(n => n.type === "trigger");
  
  for (const trigger of triggers) {
    const incomingEdge = edges.find(e => e.target_id === trigger.id);
    if (incomingEdge) {
      const sourceNode = nodes.find(n => n.id === incomingEdge.source_id);
      if (sourceNode && sourceNode.type === "whatsapp") {
        const whatsappConnectionId = sourceNode.data.connectionId as string;
        if (connectionId && whatsappConnectionId && whatsappConnectionId !== connectionId) {
          continue;
        }
      }
    }
    
    const triggerType = trigger.data.triggerType as string;
    const triggerValue = (trigger.data.triggerValue as string || "").toLowerCase();
    const messageLower = message.toLowerCase();

    if (triggerType === "new_conversation" && isNewConversation) return trigger;
    
    if (triggerType === "keyword") {
      const keywords = triggerValue.split(",").map(k => k.trim());
      if (keywords.some(k => messageLower.includes(k))) return trigger;
    }
    
    if (triggerType === "phrase" && messageLower.includes(triggerValue)) return trigger;
  }

  return null;
}

// Match user input to menu option
function matchMenuOption(
  userInput: string, 
  menuOptions: Array<{ id: string; text: string }>
): { id: string; text: string } | null {
  const inputLower = userInput.toLowerCase().trim();
  
  const numericInput = parseInt(inputLower, 10);
  if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= menuOptions.length) {
    return menuOptions[numericInput - 1];
  }
  
  for (const option of menuOptions) {
    if (option.text.toLowerCase() === inputLower) return option;
  }
  
  for (const option of menuOptions) {
    if (option.text.toLowerCase().includes(inputLower) || inputLower.includes(option.text.toLowerCase())) {
      return option;
    }
  }
  
  return null;
}

// Format phone number for sending via Baileys
function formatPhoneForBaileys(phone: string, whatsappLid?: string): { formattedPhone: string; isLid: boolean } {
  // If we have a real phone number, use it
  const cleanPhone = phone?.replace(/\D/g, "") || "";
  const isRealPhone = cleanPhone.length >= 10 && cleanPhone.length <= 14;
  
  if (isRealPhone) {
    let formatted = cleanPhone;
    if (!formatted.startsWith("55") && formatted.length <= 11) {
      formatted = "55" + formatted;
    }
    return { formattedPhone: formatted, isLid: false };
  }
  
  // If we have a LID, send via LID protocol (Baileys supports this)
  if (whatsappLid) {
    const cleanLid = whatsappLid.replace(/\D/g, "");
    return { formattedPhone: `${cleanLid}@lid`, isLid: true };
  }
  
  // Phone might be a LID stored as phone (legacy)
  if (cleanPhone.length > 14) {
    return { formattedPhone: `${cleanPhone}@lid`, isLid: true };
  }
  
  // Fallback
  return { formattedPhone: cleanPhone, isLid: false };
}

// Execute flow from a specific node
async function executeFlowFromNode(
  supabase: any,
  nodes: FlowNode[],
  edges: FlowEdge[],
  startNode: FlowNode | null,
  conversationId: string,
  contactId: string,
  phone: string,
  messageContent: string,
  baileysConfig: BaileysConfig,
  contactName: string,
  flowId: string
): Promise<void> {
  let currentNode = startNode;
  let iterationCount = 0;
  const maxIterations = 50;

  while (currentNode && iterationCount < maxIterations) {
    iterationCount++;
    console.log("[FlowExecutor] Executing node:", currentNode.type, currentNode.id);

    switch (currentNode.type) {
      case "message": {
        const content = currentNode.data.content as string || "";
        const messageType = currentNode.data.messageType as string || "text";
        const mediaUrl = currentNode.data.mediaUrl as string;
        
        const processedContent = content
          .replace(/\{\{nome\}\}/gi, contactName || "")
          .replace(/\{\{telefone\}\}/gi, phone || "");

        await sendWhatsAppMessage(
          baileysConfig,
          phone,
          processedContent,
          mediaUrl,
          messageType !== "text" ? messageType : undefined
        );

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          content: processedContent,
          sender_type: "bot",
          message_type: messageType,
          media_url: mediaUrl || null,
        });

        currentNode = getNextNode(nodes, edges, currentNode.id);
        break;
      }

      case "delay": {
        const delay = (currentNode.data.delay as number) || 1;
        const unit = (currentNode.data.unit as string) || "seconds";
        
        let delayMs = delay * 1000;
        if (unit === "minutes") delayMs = delay * 60 * 1000;
        if (unit === "hours") delayMs = delay * 60 * 60 * 1000;
        
        delayMs = Math.min(delayMs, 30000);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        currentNode = getNextNode(nodes, edges, currentNode.id);
        break;
      }

      case "menu": {
        const title = currentNode.data.title as string || "Escolha uma opção:";
        const options = (currentNode.data.options as Array<{ id: string; text: string }>) || [];
        
        let menuText = title + "\n\n";
        options.forEach((opt, idx) => {
          menuText += `${idx + 1}. ${opt.text}\n`;
        });

        await sendWhatsAppMessage(baileysConfig, phone, menuText);
        
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          content: menuText,
          sender_type: "bot",
          message_type: "text",
        });

        const flowState: FlowState = {
          currentNodeId: currentNode.id,
          awaitingMenuResponse: true,
          menuOptions: options,
          menuTitle: title,
          flowId: flowId,
        };

        await supabase
          .from("conversations")
          .update({ flow_state: flowState })
          .eq("id", conversationId);

        currentNode = null;
        break;
      }

      case "ai": {
        const isEnabled = currentNode.data.isEnabled !== false;
        
        if (isEnabled) {
          const systemPrompt = currentNode.data.systemPrompt as string || "Você é um assistente útil.";
          const model = currentNode.data.model as string || "google/gemini-2.5-flash";
          const temperature = (currentNode.data.temperature as number) ?? 0.7;
          const maxTokens = (currentNode.data.maxTokens as number) || 4096;
          const knowledgeBase = currentNode.data.knowledgeBase as string;
          const useOwnApiKey = currentNode.data.useOwnApiKey as boolean;
          const googleApiKey = currentNode.data.googleApiKey as string;

          const conversationHistory = await fetchConversationHistory(supabase, conversationId, 10);

          const aiResponse = await callAI(
            systemPrompt, messageContent, model, temperature, maxTokens, 
            knowledgeBase, useOwnApiKey, googleApiKey, conversationHistory, supabase
          );

          // Split long AI responses into multiple messages
          const aiChunks = splitLongMessage(aiResponse);
          for (let i = 0; i < aiChunks.length; i++) {
            await sendTypingPresence(baileysConfig, phone);
            await new Promise(r => setTimeout(r, humanTypingDelay(aiChunks[i])));
            await sendWhatsAppMessage(baileysConfig, phone, aiChunks[i]);
          }
          
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: aiResponse,
            sender_type: "bot",
            message_type: "text",
          });

          // Auto-tag conversation based on AI interaction
          autoTagConversation(supabase, conversationId, messageContent, aiResponse).catch(() => {});

          const nextNode = getNextNode(nodes, edges, currentNode.id);
          
          if (nextNode) {
            currentNode = nextNode;
          } else {
            const aiState: FlowState = {
              currentNodeId: currentNode.id,
              awaitingMenuResponse: false,
              awaitingAIResponse: true,
              aiNodeData: { systemPrompt, model, temperature, maxTokens, knowledgeBase, useOwnApiKey, googleApiKey },
              flowId: flowId,
            };
            
            await supabase
              .from("conversations")
              .update({ flow_state: aiState })
              .eq("id", conversationId);
            
            currentNode = null;
          }
        } else {
          currentNode = getNextNode(nodes, edges, currentNode.id);
        }
        break;
      }

      case "crm": {
        const kanbanColumnId = currentNode.data.kanbanColumnId as string;
        
        if (kanbanColumnId) {
          await supabase
            .from("conversations")
            .update({ kanban_column_id: kanbanColumnId })
            .eq("id", conversationId);
        }

        currentNode = getNextNode(nodes, edges, currentNode.id);
        break;
      }

      case "transfer": {
        const transferType = currentNode.data.transferType as string || "queue";
        const message = currentNode.data.message as string;
        
        if (message) {
          await sendWhatsAppMessage(baileysConfig, phone, message);
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: message,
            sender_type: "bot",
            message_type: "text",
          });
        }

        const updateData: Record<string, unknown> = {
          is_bot_active: false,
          active_flow_id: null,
          flow_state: null,
          status: "in_progress",
        };

        if (transferType === "queue" && currentNode.data.queueId) {
          updateData.queue_id = currentNode.data.queueId;
        }
        if (transferType === "agent" && currentNode.data.agentId) {
          updateData.assigned_to = currentNode.data.agentId;
        }

        await supabase
          .from("conversations")
          .update(updateData)
          .eq("id", conversationId);

        currentNode = null;
        break;
      }

      case "end": {
        const message = currentNode.data.message as string;
        const markAsResolved = currentNode.data.markAsResolved !== false;
        
        if (message) {
          await sendWhatsAppMessage(baileysConfig, phone, message);
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: message,
            sender_type: "bot",
            message_type: "text",
          });
        }

        await supabase
          .from("conversations")
          .update({
            is_bot_active: false,
            active_flow_id: null,
            flow_state: null,
            status: markAsResolved ? "resolved" : "in_progress",
          })
          .eq("id", conversationId);

        currentNode = null;
        break;
      }

      case "whatsapp": {
        currentNode = getNextNode(nodes, edges, currentNode.id);
        break;
      }

      case "condition": {
        const conditionResult = await evaluateCondition(
          supabase, currentNode.data, conversationId, contactId,
          messageContent, contactName, phone
        );
        
        const nextNodeId = conditionResult ? "yes" : "no";
        currentNode = getNextNode(nodes, edges, currentNode.id, nextNodeId);
        break;
      }

      case "schedule": {
        const actionType = currentNode.data.actionType as string || "check_availability";
        
        const { data: integration, error: intError } = await supabase
          .from("integrations")
          .select("*")
          .eq("type", "google_calendar")
          .eq("is_active", true)
          .maybeSingle();

        if (intError || !integration) {
          const errorMsg = "Desculpe, o sistema de agendamento não está disponível no momento.";
          await sendWhatsAppMessage(baileysConfig, phone, errorMsg);
          await supabase.from("messages").insert({
            conversation_id: conversationId, content: errorMsg, sender_type: "bot", message_type: "text",
          });
          currentNode = getNextNode(nodes, edges, currentNode.id);
          break;
        }

        const config = integration.config as Record<string, string>;
        const calendarId = config?.selected_calendar_id || "primary";

        if (actionType === "check_availability") {
          const period = currentNode.data.period as string || "today";
          const serviceDuration = (currentNode.data.serviceDuration as number) || 60;
          const workingHoursStart = currentNode.data.workingHoursStart as string || "09:00";
          const workingHoursEnd = currentNode.data.workingHoursEnd as string || "18:00";
          const maxOptions = (currentNode.data.maxOptions as number) || 5;

          const dates: Date[] = [];
          const today = new Date();
          
          switch (period) {
            case "today": dates.push(today); break;
            case "tomorrow": {
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              dates.push(tomorrow);
              break;
            }
            case "next_3_days":
              for (let i = 0; i < 3; i++) { const d = new Date(today); d.setDate(d.getDate() + i); dates.push(d); }
              break;
            case "next_7_days":
              for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() + i); dates.push(d); }
              break;
          }

          const allSlots: Array<{ start: string; end: string; displayDate: string; displayTime: string }> = [];

          for (const date of dates) {
            try {
              const { data: slotsData, error: slotsError } = await supabase.functions.invoke("google-calendar", {
                body: {
                  action: "check-availability",
                  integration_id: integration.id,
                  calendar_id: calendarId,
                  date: date.toISOString(),
                  service_duration: serviceDuration,
                  working_hours_start: workingHoursStart,
                  working_hours_end: workingHoursEnd,
                },
              });

              if (!slotsError && slotsData?.available_slots) {
                for (const slot of slotsData.available_slots) {
                  const startDate = new Date(slot.start);
                  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                  const dayName = dayNames[startDate.getDay()];
                  const displayDate = `${dayName}, ${startDate.getDate().toString().padStart(2, "0")}/${(startDate.getMonth() + 1).toString().padStart(2, "0")}`;
                  const displayTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;
                  
                  allSlots.push({ start: slot.start, end: slot.end, displayDate, displayTime });
                }
              }
            } catch (error) {
              console.error("[FlowExecutor] Error fetching slots for date:", date, error);
            }
          }

          if (allSlots.length === 0) {
            const noSlotsMsg = "Desculpe, não há horários disponíveis no período selecionado. Por favor, tente novamente mais tarde ou entre em contato conosco.";
            await sendWhatsAppMessage(baileysConfig, phone, noSlotsMsg);
            await supabase.from("messages").insert({
              conversation_id: conversationId, content: noSlotsMsg, sender_type: "bot", message_type: "text",
            });
            currentNode = getNextNode(nodes, edges, currentNode.id);
            break;
          }

          const displaySlots = allSlots.slice(0, maxOptions);
          
          let slotsMessage = "📅 *Horários Disponíveis*\n\nEscolha um horário digitando o número correspondente:\n\n";
          displaySlots.forEach((slot, idx) => {
            slotsMessage += `${idx + 1}. ${slot.displayDate} às ${slot.displayTime}\n`;
          });
          slotsMessage += `\n0. Cancelar`;

          await sendWhatsAppMessage(baileysConfig, phone, slotsMessage);
          
          await supabase.from("messages").insert({
            conversation_id: conversationId, content: slotsMessage, sender_type: "bot", message_type: "text",
          });

          const nextNode = getNextNode(nodes, edges, currentNode.id);
          const eventTitle = nextNode?.data?.eventTitle as string || currentNode.data.eventTitle as string || "Agendamento";
          const eventDescription = nextNode?.data?.eventDescription as string || currentNode.data.eventDescription as string || "";
          const eventDuration = nextNode?.data?.eventDuration as number || serviceDuration;
          const sendConfirmation = nextNode?.data?.sendConfirmation !== false;

          const scheduleState: FlowState = {
            currentNodeId: currentNode.id,
            awaitingMenuResponse: false,
            awaitingScheduleResponse: true,
            scheduleNodeData: {
              integrationId: integration.id,
              calendarId,
              availableSlots: displaySlots.map(s => ({ start: s.start, end: s.end })),
              eventTitle, eventDescription, eventDuration, sendConfirmation,
            },
            flowId: flowId,
          };

          await supabase
            .from("conversations")
            .update({ flow_state: scheduleState })
            .eq("id", conversationId);

          currentNode = null;
        } else if (actionType === "create_event") {
          currentNode = getNextNode(nodes, edges, currentNode.id);
        }
        break;
      }

      default:
        currentNode = getNextNode(nodes, edges, currentNode.id);
    }
  }

  if (iterationCount >= maxIterations) {
    console.error("[FlowExecutor] Max iterations reached, stopping execution");
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { conversationId, contactId, message: rawMessage, messageType: incomingMessageType, mediaUrl: incomingMediaUrl, connectionId, isNewConversation, baileysMessageId } = body;

    console.log("[FlowExecutor] Received request:", { conversationId, contactId, messagePreview: rawMessage?.substring(0, 50), messageType: incomingMessageType, mediaUrl: incomingMediaUrl?.substring(0, 60), connectionId, isNewConversation, baileysMessageId });

    // Create supabase client early for audio download
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Transcribe audio or describe image if needed
    let message = rawMessage;
    const sessionName = await (async () => {
      if (!connectionId) return "default";
      const { data: conn } = await supabase.from("connections").select("session_data, name").eq("id", connectionId).single();
      if (!conn) return "default";
      const sd = conn.session_data as any;
      return sd?.sessionName || conn.name.toLowerCase().replace(/\s+/g, "_");
    })();

    if (incomingMessageType === "audio") {
      console.log("[FlowExecutor] Audio message detected, mediaUrl:", incomingMediaUrl || "NULL", ", baileysMessageId:", baileysMessageId || "NULL");

      let audioMediaUrl = incomingMediaUrl;

      // If mediaUrl is null, try downloading directly from Baileys server
      if (!audioMediaUrl && baileysMessageId) {
        console.log("[FlowExecutor] mediaUrl is null, attempting Baileys direct download...");
        const audioData = await downloadMediaFromBaileys(supabase, baileysMessageId, sessionName);
        if (audioData) {
          body._audioBase64 = audioData.base64;
          body._audioContentType = audioData.contentType;
          audioMediaUrl = "__direct__";
        }
      }

      if (audioMediaUrl || body._audioBase64) {
        console.log("[FlowExecutor] Attempting transcription...");
        message = await transcribeAudio(audioMediaUrl === "__direct__" ? null : audioMediaUrl, body, supabase);
        console.log("[FlowExecutor] Transcription result:", message?.substring(0, 100));
      } else {
        console.warn("[FlowExecutor] No audio source available, using fallback message");
        message = "[O contato enviou um áudio. Peça gentilmente que repita a mensagem em texto, explicando que você precisa da mensagem escrita para poder ajudar melhor.]";
      }
    } else if (incomingMessageType === "image") {
      console.log("[FlowExecutor] Image message detected, mediaUrl:", incomingMediaUrl || "NULL", ", baileysMessageId:", baileysMessageId || "NULL");

      const mediaData = await getMediaBase64(incomingMediaUrl, baileysMessageId, sessionName, supabase);
      if (mediaData) {
        console.log(`[FlowExecutor] Image obtained: ${mediaData.base64.length} base64 chars, type: ${mediaData.contentType}`);
        const imageDescription = await describeImage(mediaData.base64, mediaData.contentType, supabase);
        const caption = rawMessage && rawMessage !== "[Imagem]" ? rawMessage : "";
        message = `[Descrição da imagem enviada pelo contato]: ${imageDescription}`;
        if (caption) message += `\n[Legenda]: ${caption}`;
        console.log("[FlowExecutor] Image description result:", message.substring(0, 150));
      } else {
        console.warn("[FlowExecutor] Could not obtain image data");
        const caption = rawMessage && rawMessage !== "[Imagem]" ? rawMessage : "";
        message = "[O contato enviou uma imagem que não pôde ser analisada. Peça gentilmente que descreva o conteúdo da imagem em texto.]";
        if (caption) message += `\n[Legenda]: ${caption}`;
      }
    }

    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: "conversationId and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // supabase client already created above

    // Fetch conversation data
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("[FlowExecutor] Conversation not found:", convError);
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if bot is active for this conversation
    if (conversation.is_bot_active === false) {
      console.log("[FlowExecutor] Bot is inactive for this conversation, skipping");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "bot_inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contact = conversation.contacts as any;
    const contactName = contact?.name || "";
    const contactPhone = contact?.phone || "";
    const whatsappLid = contact?.whatsapp_lid || "";

    // Format phone for Baileys
    const { formattedPhone } = formatPhoneForBaileys(contactPhone, whatsappLid);

    if (!formattedPhone) {
      console.error("[FlowExecutor] No valid phone or LID for contact:", contactId);
      return new Response(JSON.stringify({ error: "No valid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load connection data
    const effectiveConnectionId = connectionId || conversation.connection_id;
    let connection: any = null;

    if (effectiveConnectionId) {
      const { data: conn } = await supabase
        .from("connections")
        .select("*")
        .eq("id", effectiveConnectionId)
        .single();
      connection = conn;
    }

    if (!connection) {
      // Fallback: get default connection
      const { data: defaultConn } = await supabase
        .from("connections")
        .select("*")
        .eq("is_default", true)
        .eq("status", "connected")
        .maybeSingle();
      connection = defaultConn;
    }

    if (!connection) {
      console.error("[FlowExecutor] No WhatsApp connection available");
      return new Response(JSON.stringify({ error: "No WhatsApp connection" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Baileys config
    const baileysConfig = await loadBaileysConfig(supabase, connection);
    if (!baileysConfig) {
      return new Response(JSON.stringify({ error: "Baileys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flowState = conversation.flow_state as FlowState | null;

    // === CASE 1: Resume from pending state ===
    if (flowState) {
      console.log("[FlowExecutor] Resuming from flow state:", { flowId: flowState.flowId, awaitingMenu: flowState.awaitingMenuResponse, awaitingAI: flowState.awaitingAIResponse, awaitingSchedule: flowState.awaitingScheduleResponse });

      // Load flow nodes and edges
      const [{ data: nodes }, { data: edges }] = await Promise.all([
        supabase.from("flow_nodes").select("*").eq("flow_id", flowState.flowId),
        supabase.from("flow_edges").select("*").eq("flow_id", flowState.flowId),
      ]);

      if (!nodes || !edges) {
        console.error("[FlowExecutor] Could not load flow data");
        await supabase.from("conversations").update({ flow_state: null, active_flow_id: null }).eq("id", conversationId);
        return new Response(JSON.stringify({ error: "Flow data not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const flowNodes: FlowNode[] = nodes.map((n: any) => ({ id: n.id, type: n.type, data: n.data || {} }));
      const flowEdges: FlowEdge[] = edges.map((e: any) => ({ id: e.id, source_id: e.source_id, target_id: e.target_id, label: e.label }));

      // Handle menu response
      if (flowState.awaitingMenuResponse && flowState.menuOptions) {
        const selectedOption = matchMenuOption(message, flowState.menuOptions);

        if (!selectedOption) {
          const retryMsg = `Opção inválida. Por favor, escolha uma das opções:\n\n${flowState.menuOptions.map((o, i) => `${i + 1}. ${o.text}`).join("\n")}`;
          await sendWhatsAppMessage(baileysConfig, formattedPhone, retryMsg);
          await supabase.from("messages").insert({ conversation_id: conversationId, content: retryMsg, sender_type: "bot", message_type: "text" });
          return new Response(JSON.stringify({ success: true, action: "menu_retry" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Clear state and continue from menu option edge
        await supabase.from("conversations").update({ flow_state: null }).eq("id", conversationId);

        const nextNode = getNextNode(flowNodes, flowEdges, flowState.currentNodeId, selectedOption.id);
        if (nextNode) {
          await executeFlowFromNode(supabase, flowNodes, flowEdges, nextNode, conversationId, contactId || contact.id, formattedPhone, message, baileysConfig, contactName, flowState.flowId);
        }

        return new Response(JSON.stringify({ success: true, action: "menu_continued" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle AI response (continue conversation with AI)
      if (flowState.awaitingAIResponse && flowState.aiNodeData) {
        const { systemPrompt, model, temperature, maxTokens, knowledgeBase, useOwnApiKey, googleApiKey } = flowState.aiNodeData;

        // Apply response delay from flow config (fixed or random)
        try {
          const { data: flowCfgData } = await supabase.from("chatbot_flows").select("config").eq("id", flowState.flowId).single();
          const fCfg = flowCfgData?.config as any;
          const delayMin = fCfg?.responseDelay || 0;
          const delayMax = fCfg?.responseDelayMax || delayMin;
          const isRandom = fCfg?.responseDelayMode === "random";
          const actualDelay = isRandom && delayMax > delayMin
            ? Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin
            : delayMin;
          if (actualDelay > 0) {
            const delayMs = Math.min(actualDelay * 1000, 120000);
            console.log(`[FlowExecutor] Waiting ${actualDelay}s before AI response (mode: ${isRandom ? "random" : "fixed"})...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } catch {}

        const conversationHistory = await fetchConversationHistory(supabase, conversationId, 10);

        const aiResponse = await callAI(systemPrompt, message, model, temperature, maxTokens, knowledgeBase, useOwnApiKey, googleApiKey, conversationHistory, supabase);

        // Split long AI responses into multiple messages
        const aiChunks = splitLongMessage(aiResponse);
        for (let i = 0; i < aiChunks.length; i++) {
          await sendTypingPresence(baileysConfig, formattedPhone);
          await new Promise(r => setTimeout(r, humanTypingDelay(aiChunks[i])));
          await sendWhatsAppMessage(baileysConfig, formattedPhone, aiChunks[i]);
        }
        await supabase.from("messages").insert({ conversation_id: conversationId, content: aiResponse, sender_type: "bot", message_type: "text" });

        // Auto-tag conversation based on AI interaction
        autoTagConversation(supabase, conversationId, message, aiResponse).catch(() => {});

        // Cancel existing pending follow-ups and schedule new one if enabled
        await supabase.from("follow_ups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("status", "pending");

        // Check if flow has follow-up enabled in config
        try {
          const { data: flowConfig } = await supabase
            .from("chatbot_flows")
            .select("config")
            .eq("id", flowState.flowId)
            .single();

          const cfg = flowConfig?.config as any;
          if (cfg?.followUpEnabled) {
            // Calculate interval: prioritize stepConfigs[0], fallback to followUpIntervalMinutes, default 60
            const stepConfigs = cfg.followUpStepConfigs as any[] | null;
            const firstStepInterval = stepConfigs?.[0]?.intervalMinutes || stepConfigs?.[0]?.interval;
            const firstStepUnit = stepConfigs?.[0]?.unit || "minutes";
            let intervalMinutes = cfg.followUpIntervalMinutes || firstStepInterval || 60;
            if (firstStepInterval && firstStepUnit === "hours") intervalMinutes = firstStepInterval * 60;
            if (firstStepInterval && firstStepUnit === "days") intervalMinutes = firstStepInterval * 1440;

            const scheduledAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
            const { error: fuInsertErr } = await supabase.from("follow_ups").insert({
              conversation_id: conversationId,
              contact_id: contactId || contact.id,
              connection_id: effectiveConnectionId || null,
              flow_id: flowState.flowId,
              step: 1,
              max_steps: cfg.followUpSteps || stepConfigs?.length || 3,
              interval_minutes: intervalMinutes,
              mode: cfg.followUpMode || "ai",
              status: "pending",
              follow_up_prompt: cfg.followUpPrompt || null,
              fixed_messages: cfg.followUpMessages || [],
              final_action: cfg.followUpFinalAction || "none",
              transfer_queue_id: cfg.followUpTransferQueueId || null,
              scheduled_at: scheduledAt.toISOString(),
              step_intervals: stepConfigs || [],
              allowed_hours_start: cfg.followUpAllowedHoursStart || "08:00",
              allowed_hours_end: cfg.followUpAllowedHoursEnd || "20:00",
              allowed_days: cfg.followUpAllowedDays || ["mon","tue","wed","thu","fri"],
              follow_up_model: cfg.followUpModel || "google/gemini-2.5-flash",
              follow_up_temperature: cfg.followUpTemperature ?? 0.8,
              stop_on_human_assign: cfg.followUpStopOnHumanAssign ?? true,
              closing_message: cfg.followUpClosingMessage || null,
            });
            if (fuInsertErr) {
              console.error("[FlowExecutor] Error inserting follow-up:", fuInsertErr);
            } else {
              console.log(`[FlowExecutor] Follow-up scheduled for ${scheduledAt.toISOString()}`);
            }
          }
        } catch (fuErr) {
          console.error("[FlowExecutor] Error scheduling follow-up:", fuErr);
        }

        // AI stays in loop (no next node), keep state
        return new Response(JSON.stringify({ success: true, action: "ai_response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle schedule response
      if (flowState.awaitingScheduleResponse && flowState.scheduleNodeData) {
        const { integrationId, calendarId, availableSlots, eventTitle, eventDescription, eventDuration, sendConfirmation } = flowState.scheduleNodeData;

        const input = message.trim();

        if (input === "0") {
          const cancelMsg = "Agendamento cancelado. Como posso ajudá-lo?";
          await sendWhatsAppMessage(baileysConfig, formattedPhone, cancelMsg);
          await supabase.from("messages").insert({ conversation_id: conversationId, content: cancelMsg, sender_type: "bot", message_type: "text" });
          await supabase.from("conversations").update({ flow_state: null, active_flow_id: null }).eq("id", conversationId);
          return new Response(JSON.stringify({ success: true, action: "schedule_cancelled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const slotIndex = parseInt(input, 10) - 1;
        if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= availableSlots.length) {
          const retryMsg = `Opção inválida. Digite um número de 1 a ${availableSlots.length} ou 0 para cancelar.`;
          await sendWhatsAppMessage(baileysConfig, formattedPhone, retryMsg);
          await supabase.from("messages").insert({ conversation_id: conversationId, content: retryMsg, sender_type: "bot", message_type: "text" });
          return new Response(JSON.stringify({ success: true, action: "schedule_retry" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const selectedSlot = availableSlots[slotIndex];

        try {
          const { data: eventData, error: eventError } = await supabase.functions.invoke("google-calendar", {
            body: {
              action: "create-event",
              integration_id: integrationId,
              calendar_id: calendarId,
              title: `${eventTitle} - ${contactName}`,
              description: `${eventDescription}\nContato: ${contactName}\nTelefone: ${contactPhone}`,
              start_time: selectedSlot.start,
              end_time: selectedSlot.end,
              contact_id: contactId || contact.id,
              conversation_id: conversationId,
            },
          });

          if (eventError) throw eventError;

          const startDate = new Date(selectedSlot.start);
          const confirmMsg = sendConfirmation
            ? `✅ Agendamento confirmado!\n\n📅 ${startDate.toLocaleDateString("pt-BR")}\n🕐 ${startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\nObrigado!`
            : "Agendamento confirmado!";

          await sendWhatsAppMessage(baileysConfig, formattedPhone, confirmMsg);
          await supabase.from("messages").insert({ conversation_id: conversationId, content: confirmMsg, sender_type: "bot", message_type: "text" });
        } catch (error) {
          console.error("[FlowExecutor] Error creating event:", error);
          const errorMsg = "Desculpe, houve um erro ao criar o agendamento. Tente novamente.";
          await sendWhatsAppMessage(baileysConfig, formattedPhone, errorMsg);
          await supabase.from("messages").insert({ conversation_id: conversationId, content: errorMsg, sender_type: "bot", message_type: "text" });
        }

        // Clear state and continue
        await supabase.from("conversations").update({ flow_state: null }).eq("id", conversationId);

        const nextNode = getNextNode(flowNodes, flowEdges, flowState.currentNodeId);
        if (nextNode) {
          await executeFlowFromNode(supabase, flowNodes, flowEdges, nextNode, conversationId, contactId || contact.id, formattedPhone, message, baileysConfig, contactName, flowState.flowId);
        }

        return new Response(JSON.stringify({ success: true, action: "schedule_completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === CASE 2: Find matching trigger in active flows ===
    const { data: activeFlows, error: flowsError } = await supabase
      .from("chatbot_flows")
      .select("*")
      .eq("is_active", true);

    if (flowsError || !activeFlows || activeFlows.length === 0) {
      console.log("[FlowExecutor] No active flows found");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_active_flows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search through all active flows for a matching trigger
    for (const flow of activeFlows) {
      const cfg = flow.config as any;

      // === CONFIG-BASED AGENT (new system — no flow_nodes) ===
      if (cfg && cfg.aiEnabled) {
        const triggerType = cfg.triggerType || flow.trigger_type || "keyword";
        const triggerValue = (cfg.triggerValue || flow.trigger_value || "").toLowerCase();
        const messageLower = message.toLowerCase();

        // Check connection filter
        if (cfg.connectionId && effectiveConnectionId && cfg.connectionId !== effectiveConnectionId) {
          continue;
        }

        let triggerMatched = false;
        if (triggerType === "all") triggerMatched = true;
        else if (triggerType === "new_conversation" && isNewConversation) triggerMatched = true;
        else if (triggerType === "keyword" && triggerValue) {
          const keywords = triggerValue.split(",").map((k: string) => k.trim());
          triggerMatched = keywords.some((k: string) => messageLower.includes(k));
        } else if (triggerType === "phrase" && triggerValue) {
          triggerMatched = messageLower.includes(triggerValue);
        }

        if (triggerMatched) {
          console.log("[FlowExecutor] Config-based agent matched:", flow.id, flow.name);

          // Activate flow on conversation
          await supabase.from("conversations").update({
            active_flow_id: flow.id,
            is_bot_active: true,
            flow_state: {
              flowId: flow.id,
              awaitingAIResponse: true,
              currentNodeId: "config-agent",
              awaitingMenuResponse: false,
              aiNodeData: {
                systemPrompt: cfg.systemPrompt || "Você é um assistente virtual amigável.",
                model: cfg.model || "google/gemini-2.5-flash",
                temperature: cfg.temperature ?? 0.7,
                maxTokens: cfg.maxTokens || 4096,
                knowledgeBase: cfg.knowledgeBase || "",
              },
            },
          }).eq("id", conversationId);

          // Apply response delay (fixed or random)
          {
            const delayMin = cfg.responseDelay || 0;
            const delayMax = cfg.responseDelayMax || delayMin;
            const isRandom = cfg.responseDelayMode === "random";
            const actualDelay = isRandom && delayMax > delayMin
              ? Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin
              : delayMin;
            if (actualDelay > 0) {
              const delayMs = Math.min(actualDelay * 1000, 120000);
              console.log(`[FlowExecutor] Waiting ${actualDelay}s before responding (mode: ${isRandom ? "random" : "fixed"})...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }

          // Fetch history and call AI
          const conversationHistory = await fetchConversationHistory(supabase, conversationId, 10);
          const aiResponse = await callAI(
            cfg.systemPrompt || "Você é um assistente virtual amigável.",
            message,
            cfg.model || "google/gemini-2.5-flash",
            cfg.temperature ?? 0.7,
            cfg.maxTokens || 4096,
            cfg.knowledgeBase || "",
            false,
            undefined,
            conversationHistory,
            supabase
          );

          const aiChunks = splitLongMessage(aiResponse);
          for (let i = 0; i < aiChunks.length; i++) {
            await sendTypingPresence(baileysConfig, formattedPhone);
            await new Promise(r => setTimeout(r, humanTypingDelay(aiChunks[i])));
            await sendWhatsAppMessage(baileysConfig, formattedPhone, aiChunks[i]);
          }
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: aiResponse,
            sender_type: "bot",
            message_type: "text",
          });

          // Auto-tag
          autoTagConversation(supabase, conversationId, message, aiResponse).catch(() => {});

          // Schedule follow-up if enabled
          if (cfg.followUpEnabled) {
            await supabase.from("follow_ups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("status", "pending");
            
            const stepConfigs = cfg.followUpStepConfigs as any[] | null;
            const firstStepInterval = stepConfigs?.[0]?.intervalMinutes || stepConfigs?.[0]?.interval;
            const firstStepUnit = stepConfigs?.[0]?.unit || "minutes";
            let intervalMinutes = cfg.followUpIntervalMinutes || firstStepInterval || 60;
            if (firstStepInterval && firstStepUnit === "hours") intervalMinutes = firstStepInterval * 60;
            if (firstStepInterval && firstStepUnit === "days") intervalMinutes = firstStepInterval * 1440;

            const scheduledAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
            const { error: fuInsertErr } = await supabase.from("follow_ups").insert({
              conversation_id: conversationId,
              contact_id: contactId || contact.id,
              connection_id: effectiveConnectionId || null,
              flow_id: flow.id,
              step: 1,
              max_steps: cfg.followUpSteps || stepConfigs?.length || 3,
              interval_minutes: intervalMinutes,
              mode: cfg.followUpMode || "ai",
              status: "pending",
              follow_up_prompt: cfg.followUpPrompt || null,
              fixed_messages: cfg.followUpMessages || [],
              final_action: cfg.followUpFinalAction || "none",
              transfer_queue_id: cfg.followUpTransferQueueId || null,
              scheduled_at: scheduledAt.toISOString(),
              step_intervals: stepConfigs || [],
              allowed_hours_start: cfg.followUpAllowedHoursStart || "08:00",
              allowed_hours_end: cfg.followUpAllowedHoursEnd || "20:00",
              allowed_days: cfg.followUpAllowedDays || ["mon","tue","wed","thu","fri"],
              follow_up_model: cfg.followUpModel || "google/gemini-2.5-flash",
              follow_up_temperature: cfg.followUpTemperature ?? 0.8,
              stop_on_human_assign: cfg.followUpStopOnHumanAssign ?? true,
              closing_message: cfg.followUpClosingMessage || null,
            });
            if (fuInsertErr) {
              console.error("[FlowExecutor] Error inserting follow-up:", fuInsertErr);
            } else {
              console.log(`[FlowExecutor] Follow-up scheduled for ${scheduledAt.toISOString()}`);
            }
          }

          return new Response(JSON.stringify({ success: true, action: "config_agent_executed", flowId: flow.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      // === LEGACY NODE-BASED FLOW ===
      const [{ data: nodes }, { data: edges }] = await Promise.all([
        supabase.from("flow_nodes").select("*").eq("flow_id", flow.id),
        supabase.from("flow_edges").select("*").eq("flow_id", flow.id),
      ]);

      if (!nodes || !edges || nodes.length === 0) continue;

      const flowNodes: FlowNode[] = nodes.map((n: any) => ({ id: n.id, type: n.type, data: n.data || {} }));
      const flowEdges: FlowEdge[] = edges.map((e: any) => ({ id: e.id, source_id: e.source_id, target_id: e.target_id, label: e.label }));

      const trigger = findMatchingTrigger(flowNodes, flowEdges, message, isNewConversation || false, effectiveConnectionId);

      if (trigger) {
        console.log("[FlowExecutor] Trigger matched in flow:", flow.id, flow.name);

        await supabase
          .from("conversations")
          .update({ active_flow_id: flow.id, is_bot_active: true })
          .eq("id", conversationId);

        const startNode = getNextNode(flowNodes, flowEdges, trigger.id);

        if (startNode) {
          await executeFlowFromNode(supabase, flowNodes, flowEdges, startNode, conversationId, contactId || contact.id, formattedPhone, message, baileysConfig, contactName, flow.id);
        }

        return new Response(JSON.stringify({ success: true, action: "flow_executed", flowId: flow.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("[FlowExecutor] No trigger matched for message:", message.substring(0, 50));
    return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_trigger_matched" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[FlowExecutor] Handler error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export default handler;
if (import.meta.main) Deno.serve(handler);
