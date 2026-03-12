import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function loadBaileysConfig(supabase: any, connection: any) {
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
  if (!serverUrl) return null;

  const sessionData = connection.session_data as Record<string, unknown> | null;
  const sessionName = (sessionData?.sessionName as string) || connection.name.toLowerCase().replace(/\s+/g, "_");
  return { serverUrl, apiKey, sessionName };
}

async function sendWhatsAppMessage(config: any, phone: string, content: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["X-API-Key"] = config.apiKey;

    const response = await fetch(`${config.serverUrl}/sessions/${config.sessionName}/send/text`, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: phone, text: content }),
    });
    const result = await response.json();
    return response.ok && result.success;
  } catch (error) {
    console.error("[FollowUp] Error sending message:", error);
    return false;
  }
}

async function sendWhatsAppMedia(config: any, phone: string, mediaUrl: string, mediaType: string, caption?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["X-API-Key"] = config.apiKey;

    const response = await fetch(`${config.serverUrl}/sessions/${config.sessionName}/send/media`, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: phone, mediaUrl, mediaType, caption: caption || "" }),
    });
    const result = await response.json();
    return response.ok && result.success;
  } catch (error) {
    console.error("[FollowUp] Error sending media:", error);
    return false;
  }
}

function formatPhoneForBaileys(phone: string, whatsappLid?: string) {
  const cleanPhone = phone?.replace(/\D/g, "") || "";
  const isRealPhone = cleanPhone.length >= 10 && cleanPhone.length <= 14;
  if (isRealPhone) {
    let formatted = cleanPhone;
    if (!formatted.startsWith("55") && formatted.length <= 11) formatted = "55" + formatted;
    return { formattedPhone: formatted, isLid: false };
  }
  if (whatsappLid) {
    const cleanLid = whatsappLid.replace(/\D/g, "");
    return { formattedPhone: `${cleanLid}@lid`, isLid: true };
  }
  if (cleanPhone.length > 14) {
    return { formattedPhone: `${cleanPhone}@lid`, isLid: true };
  }
  return { formattedPhone: cleanPhone, isLid: false };
}

// Get current time in Brazil timezone (BRT = UTC-3)
function getBrazilTime(): Date {
  const now = new Date();
  const brasilOffset = -3 * 60; // -3 hours in minutes
  return new Date(now.getTime() + (brasilOffset + now.getTimezoneOffset()) * 60000);
}

function isWithinAllowedWindow(followUp: any): boolean {
  const now = getBrazilTime();
  
  // Check allowed days
  const allowedDays = followUp.allowed_days as string[] | null;
  if (allowedDays && allowedDays.length > 0) {
    const dayMap: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
    const currentDay = dayMap[now.getDay()];
    if (!allowedDays.includes(currentDay)) return false;
  }

  // Check allowed hours (using Brazil time)
  const start = followUp.allowed_hours_start as string | null;
  const end = followUp.allowed_hours_end as string | null;
  if (start && end) {
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (currentTime < start || currentTime > end) return false;
  }

  return true;
}

// Calculate next valid window for a follow-up that is currently outside allowed hours/days
function getNextValidScheduleTime(followUp: any): Date | null {
  const allowedDays = followUp.allowed_days as string[] | null;
  const start = followUp.allowed_hours_start as string | null;
  if (!start) return null;

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = getBrazilTime();

  // Try up to 7 days ahead
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now.getTime() + dayOffset * 86400000);
    const dayName = dayNames[candidate.getDay()];

    if (allowedDays && allowedDays.length > 0 && !allowedDays.includes(dayName)) continue;

    // Set to allowed_hours_start
    const [startH, startM] = start.split(":").map(Number);
    candidate.setHours(startH, startM, 0, 0);

    // If same day and start already passed, skip to next day
    if (dayOffset === 0 && candidate <= now) continue;

    // Convert back from BRT to UTC for storage
    const brasilOffset = -3 * 60;
    const utcTime = new Date(candidate.getTime() - (brasilOffset + now.getTimezoneOffset()) * 60000);
    return utcTime;
  }
  return null;
}

function getStepIntervalMinutes(followUp: any): number {
  const stepIntervals = followUp.step_intervals as any[] | null;
  if (stepIntervals && stepIntervals.length > 0) {
    const stepConfig = stepIntervals[followUp.step - 1];
    if (stepConfig) {
      const interval = stepConfig.interval || followUp.interval_minutes;
      const unit = stepConfig.unit || "minutes";
      if (unit === "hours") return interval * 60;
      if (unit === "days") return interval * 1440;
      return interval;
    }
  }
  return followUp.interval_minutes;
}

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

function normalizeModelName(model: string): string {
  return model.replace(/^google\//, "");
}

function isOpenAIModel(model: string): boolean {
  return model.startsWith("gpt-");
}

async function generateAIFollowUp(
  supabase: any,
  prompt: string,
  conversationId: string,
  contactName: string,
  step: number,
  maxSteps: number,
  model?: string,
  temperature?: number
): Promise<string> {
  const { data: messages } = await supabase
    .from("messages")
    .select("content, sender_type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(5);

  const history = (messages || []).reverse();

  const systemPrompt = `${prompt}

Contexto:
- Nome do contato: ${contactName}
- Esta é a mensagem de follow-up ${step} de ${maxSteps}
- O contato não respondeu à última mensagem
- Seja breve, amigável e natural. Não mencione que é um follow-up automático.
${step === maxSteps ? "- Esta é a ÚLTIMA tentativa de contato. Seja cordial ao se despedir." : ""}`;

  const fallbackMsg = "Olá! Estou aqui caso precise de algo. 😊";
  const resolvedModel = normalizeModelName(model || "gemini-2.5-flash");
  const resolvedRawModel = model || "gemini-2.5-flash";

  // If OpenAI model, use OpenAI API
  if (isOpenAIModel(resolvedRawModel)) {
    const openaiKey = await getOpenAIApiKeyFromDB(supabase);
    if (openaiKey) {
      try {
        console.log("[FollowUp] Using OpenAI API for model:", resolvedRawModel);
        const aiMessages = [
          { role: "system", content: systemPrompt },
          ...history.map((m: any) => ({
            role: m.sender_type === "contact" ? "user" : "assistant",
            content: m.content,
          })),
          { role: "user", content: "[O contato não respondeu. Gere uma mensagem de follow-up.]" },
        ];
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: resolvedRawModel,
            messages: aiMessages,
            temperature: temperature ?? 0.8,
            max_tokens: 300,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content || fallbackMsg;
        }
        console.error("[FollowUp] OpenAI error:", response.status);
      } catch (error) {
        console.error("[FollowUp] OpenAI call error:", error);
      }
    }
    return fallbackMsg;
  }

  // Try Lovable AI Gateway first
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableApiKey) {
    try {
      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...history.map((m: any) => ({
          role: m.sender_type === "contact" ? "user" : "assistant",
          content: m.content,
        })),
        { role: "user", content: "[O contato não respondeu. Gere uma mensagem de follow-up.]" },
      ];
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: model || "google/gemini-2.5-flash",
          messages: aiMessages,
          temperature: temperature ?? 0.8,
          max_tokens: 300,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || fallbackMsg;
      }
    } catch (error) {
      console.error("[FollowUp] Lovable AI error:", error);
    }
  }

  // Fallback: Google AI API key from system_settings
  const googleKey = await getGoogleApiKeyFromDB(supabase);
  if (!googleKey) {
    console.error("[FollowUp] No AI API key available");
    return fallbackMsg;
  }

  try {
    console.log("[FollowUp] Using Google AI API key from system_settings");
    const contents = history.map((m: any) => ({
      role: m.sender_type === "contact" ? "user" : "model",
      parts: [{ text: m.content }],
    }));
    contents.push({ role: "user", parts: [{ text: "[O contato não respondeu. Gere uma mensagem de follow-up.]" }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: temperature ?? 0.8, maxOutputTokens: 300 },
        }),
      }
    );
    if (!response.ok) {
      console.error("[FollowUp] Google AI error:", response.status);
      return fallbackMsg;
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || fallbackMsg;
  } catch (error) {
    console.error("[FollowUp] Google AI call error:", error);
    return fallbackMsg;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[FollowUp] Starting process-follow-ups at ${new Date().toISOString()}`);
    console.log(`[FollowUp] Supabase URL: ${supabaseUrl.substring(0, 30)}...`);

    // First count total pending for diagnostics
    const { count: totalPending } = await supabase
      .from("follow_ups")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    console.log(`[FollowUp] Total pending follow-ups in DB: ${totalPending}`);

    const { data: pendingFollowUps, error: fetchError } = await supabase
      .from("follow_ups")
      .select("*, contacts(*), conversations(*, connections(*))")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[FollowUp] Error fetching:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FollowUp] Follow-ups due now: ${pendingFollowUps?.length || 0} (total pending: ${totalPending})`);

    if (!pendingFollowUps || pendingFollowUps.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, totalPending: totalPending || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FollowUp] Processing ${pendingFollowUps.length} pending follow-ups`);
    let processed = 0;

    for (const followUp of pendingFollowUps) {
      try {
        const contact = followUp.contacts as any;
        const conversation = followUp.conversations as any;
        const connection = conversation?.connections as any;

        if (!contact || !conversation) {
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Check if conversation is resolved/archived
        if (conversation.status === "resolved" || conversation.status === "archived") {
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Check stop_on_human_assign
        if (followUp.stop_on_human_assign && conversation.assigned_to && !conversation.is_bot_active) {
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Check allowed time window — reschedule if outside
        if (!isWithinAllowedWindow(followUp)) {
          const nextValid = getNextValidScheduleTime(followUp);
          if (nextValid) {
            console.log(`[FollowUp] ${followUp.id} outside allowed window (BRT), rescheduling to ${nextValid.toISOString()}`);
            await supabase.from("follow_ups").update({
              scheduled_at: nextValid.toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", followUp.id);
          } else {
            console.log(`[FollowUp] ${followUp.id} outside allowed window, no valid window found in next 7 days`);
          }
          continue;
        }

        let activeConnection = connection;
        if (!activeConnection) {
          const { data: defaultConn } = await supabase
            .from("connections")
            .select("*")
            .eq("is_default", true)
            .eq("status", "connected")
            .maybeSingle();
          activeConnection = defaultConn;
        }

        if (!activeConnection) continue;

        const baileysConfig = await loadBaileysConfig(supabase, activeConnection);
        if (!baileysConfig) continue;

        const { formattedPhone } = formatPhoneForBaileys(contact.phone, contact.whatsapp_lid);
        if (!formattedPhone) {
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Determine step mode from step_intervals
        const stepIntervals = followUp.step_intervals as any[] | null;
        const stepConfig = stepIntervals?.[followUp.step - 1];
        const stepMode = stepConfig?.mode || followUp.mode;

        // Generate message
        let messageContent: string;
        if (stepMode === "fixed") {
          const fixedMsg = stepConfig?.message;
          if (fixedMsg) {
            messageContent = fixedMsg;
          } else {
            const fixedMessages = followUp.fixed_messages as string[] || [];
            messageContent = fixedMessages[followUp.step - 1] || fixedMessages[0] || "Olá! Posso ajudá-lo?";
          }
        } else {
          const prompt = followUp.follow_up_prompt || "Gere uma mensagem de acompanhamento amigável e natural.";
          messageContent = await generateAIFollowUp(
            supabase,
            prompt,
            followUp.conversation_id,
            contact.name,
            followUp.step,
            followUp.max_steps,
            followUp.follow_up_model,
            followUp.follow_up_temperature
          );
        }

        // Check if step has media
        const stepMediaUrl = stepConfig?.mediaUrl;
        const stepMediaType = stepConfig?.mediaType;
        const hasMedia = stepMode === "fixed" && stepMediaUrl && stepMediaType && stepMediaType !== "none";

        let sent: boolean;
        if (hasMedia) {
          sent = await sendWhatsAppMedia(baileysConfig, formattedPhone, stepMediaUrl, stepMediaType, messageContent);
        } else {
          sent = await sendWhatsAppMessage(baileysConfig, formattedPhone, messageContent);
        }

        const msgType = hasMedia ? stepMediaType : "text";

        if (sent) {
          await supabase.from("messages").insert({
            conversation_id: followUp.conversation_id,
            content: messageContent,
            sender_type: "bot",
            message_type: msgType,
            media_url: hasMedia ? stepMediaUrl : null,
          });

          await supabase.from("follow_ups").update({
            status: "sent",
            message_content: messageContent,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", followUp.id);

          if (followUp.step < followUp.max_steps) {
            const nextIntervalMinutes = getStepIntervalMinutes({
              ...followUp,
              step: followUp.step + 1,
            });
            const nextScheduled = new Date(Date.now() + nextIntervalMinutes * 60 * 1000);

            await supabase.from("follow_ups").insert({
              conversation_id: followUp.conversation_id,
              contact_id: followUp.contact_id,
              connection_id: followUp.connection_id,
              flow_id: followUp.flow_id,
              step: followUp.step + 1,
              max_steps: followUp.max_steps,
              interval_minutes: followUp.interval_minutes,
              mode: followUp.mode,
              status: "pending",
              follow_up_prompt: followUp.follow_up_prompt,
              fixed_messages: followUp.fixed_messages,
              final_action: followUp.final_action,
              transfer_queue_id: followUp.transfer_queue_id,
              scheduled_at: nextScheduled.toISOString(),
              allowed_hours_start: followUp.allowed_hours_start,
              allowed_hours_end: followUp.allowed_hours_end,
              allowed_days: followUp.allowed_days,
              follow_up_model: followUp.follow_up_model,
              follow_up_temperature: followUp.follow_up_temperature,
              closing_message: followUp.closing_message,
              step_intervals: followUp.step_intervals,
              stop_on_human_assign: followUp.stop_on_human_assign,
            });
          } else {
            // Last step — execute final action
            if (followUp.final_action === "close") {
              // Send closing message if configured
              if (followUp.closing_message) {
                await sendWhatsAppMessage(baileysConfig, formattedPhone, followUp.closing_message);
                await supabase.from("messages").insert({
                  conversation_id: followUp.conversation_id,
                  content: followUp.closing_message,
                  sender_type: "bot",
                  message_type: "text",
                });
              }
              await supabase.from("conversations").update({
                status: "resolved",
                is_bot_active: false,
                active_flow_id: null,
                flow_state: null,
              }).eq("id", followUp.conversation_id);
            } else if (followUp.final_action === "transfer" && followUp.transfer_queue_id) {
              await supabase.from("conversations").update({
                queue_id: followUp.transfer_queue_id,
                is_bot_active: false,
                active_flow_id: null,
                flow_state: null,
                status: "in_progress",
              }).eq("id", followUp.conversation_id);
            }
          }

          processed++;
          console.log(`[FollowUp] Sent ${followUp.id} step ${followUp.step}/${followUp.max_steps}`);
        } else {
          console.error("[FollowUp] Failed to send:", followUp.id);
        }
      } catch (err) {
        console.error("[FollowUp] Error processing:", followUp.id, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, total: pendingFollowUps.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[FollowUp] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;
if (import.meta.main) Deno.serve(handler);
