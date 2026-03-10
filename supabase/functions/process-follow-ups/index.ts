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

async function generateAIFollowUp(
  supabase: any,
  prompt: string,
  conversationId: string,
  contactName: string,
  step: number,
  maxSteps: number
): Promise<string> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return "Olá! Gostaria de saber se posso ajudá-lo com algo mais.";

  // Fetch last messages for context
  const { data: messages } = await supabase
    .from("messages")
    .select("content, sender_type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(5);

  const history = (messages || []).reverse().map((m: any) => ({
    role: m.sender_type === "contact" ? "user" : "assistant",
    content: m.content,
  }));

  const systemPrompt = `${prompt}

Contexto:
- Nome do contato: ${contactName}
- Esta é a mensagem de follow-up ${step} de ${maxSteps}
- O contato não respondeu à última mensagem
- Seja breve, amigável e natural. Não mencione que é um follow-up automático.
${step === maxSteps ? "- Esta é a ÚLTIMA tentativa de contato. Seja cordial ao se despedir." : ""}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: "[O contato não respondeu. Gere uma mensagem de follow-up.]" },
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FollowUp] AI error:", response.status, errorText);
      return "Olá! Estou aqui caso precise de algo. 😊";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Olá! Posso ajudá-lo com algo?";
  } catch (error) {
    console.error("[FollowUp] AI call error:", error);
    return "Olá! Estou aqui caso precise de algo. 😊";
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

    // Find pending follow-ups that are due
    const { data: pendingFollowUps, error: fetchError } = await supabase
      .from("follow_ups")
      .select("*, contacts(*), conversations(*, connections(*))")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[FollowUp] Error fetching pending follow-ups:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingFollowUps || pendingFollowUps.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
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
          console.error("[FollowUp] Missing contact/conversation for follow-up:", followUp.id);
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Check if conversation is still active
        if (conversation.status === "resolved" || conversation.status === "archived") {
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Get connection
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

        if (!activeConnection) {
          console.error("[FollowUp] No active connection for follow-up:", followUp.id);
          continue;
        }

        const baileysConfig = await loadBaileysConfig(supabase, activeConnection);
        if (!baileysConfig) {
          console.error("[FollowUp] Baileys not configured");
          continue;
        }

        const { formattedPhone } = formatPhoneForBaileys(contact.phone, contact.whatsapp_lid);
        if (!formattedPhone) {
          console.error("[FollowUp] No valid phone for contact:", contact.id);
          await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", followUp.id);
          continue;
        }

        // Generate message
        let messageContent: string;

        if (followUp.mode === "fixed") {
          const fixedMessages = followUp.fixed_messages as string[] || [];
          messageContent = fixedMessages[followUp.step - 1] || fixedMessages[0] || "Olá! Posso ajudá-lo?";
        } else {
          // AI mode
          const prompt = followUp.follow_up_prompt || "Gere uma mensagem de acompanhamento amigável e natural.";
          messageContent = await generateAIFollowUp(
            supabase,
            prompt,
            followUp.conversation_id,
            contact.name,
            followUp.step,
            followUp.max_steps
          );
        }

        // Send message
        const sent = await sendWhatsAppMessage(baileysConfig, formattedPhone, messageContent);

        if (sent) {
          // Save message in conversation
          await supabase.from("messages").insert({
            conversation_id: followUp.conversation_id,
            content: messageContent,
            sender_type: "bot",
            message_type: "text",
          });

          // Update follow-up as sent
          await supabase
            .from("follow_ups")
            .update({
              status: "sent",
              message_content: messageContent,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", followUp.id);

          // Create next step if not last
          if (followUp.step < followUp.max_steps) {
            const nextScheduled = new Date(Date.now() + followUp.interval_minutes * 60 * 1000);
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
            });
          } else {
            // Last step - execute final action
            if (followUp.final_action === "close") {
              await supabase
                .from("conversations")
                .update({
                  status: "resolved",
                  is_bot_active: false,
                  active_flow_id: null,
                  flow_state: null,
                })
                .eq("id", followUp.conversation_id);
            } else if (followUp.final_action === "transfer" && followUp.transfer_queue_id) {
              await supabase
                .from("conversations")
                .update({
                  queue_id: followUp.transfer_queue_id,
                  is_bot_active: false,
                  active_flow_id: null,
                  flow_state: null,
                  status: "in_progress",
                })
                .eq("id", followUp.conversation_id);
            }
          }

          processed++;
          console.log(`[FollowUp] Sent follow-up ${followUp.id} step ${followUp.step}/${followUp.max_steps}`);
        } else {
          console.error("[FollowUp] Failed to send message for follow-up:", followUp.id);
        }
      } catch (err) {
        console.error("[FollowUp] Error processing follow-up:", followUp.id, err);
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
