// ===========================================
// Execute Campaign - Disparo de campanhas em massa
// Usa envio direto (sem HTTP loopback) para evitar deadlock na VPS
// ===========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMessage, resolveConnection } from "../_shared/send-message.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CampaignResult {
  campaign_id: string;
  campaign_name: string;
  processed: number;
  sent: number;
  failed: number;
  retried: number;
  completed: boolean;
  skipped_reason?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function substituteVariables(message: string, contact: { name?: string; phone?: string }): string {
  let result = message;
  result = result.replace(/\{\{nome\}\}/gi, contact.name || "Cliente");
  result = result.replace(/\{\{telefone\}\}/gi, contact.phone || "");
  return result;
}

function getNextRetryTime(retryCount: number): Date {
  const delayMinutes = Math.pow(3, retryCount) * 5;
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
  return nextRetry;
}

function getRandomInterval(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function normalizeDestination(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  return digits || null;
}

function isWithinAllowedHours(start: string, end: string): boolean {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentTime >= start && currentTime <= end;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[execute-campaign] Starting campaign execution...");

    const { data: campaigns, error: campError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active");

    if (campError) {
      console.error("[execute-campaign] Error fetching campaigns:", campError.message);
      return new Response(
        JSON.stringify({ success: false, error: campError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("[execute-campaign] No active campaigns found");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma campanha ativa", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[execute-campaign] Found ${campaigns.length} active campaigns`);

    const results: CampaignResult[] = [];

    for (const campaign of campaigns) {
      const campResult: CampaignResult = {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        completed: false,
      };

      // --- Anti-ban: Check allowed hours ---
      const hoursStart = campaign.allowed_hours_start || "08:00";
      const hoursEnd = campaign.allowed_hours_end || "20:00";
      if (!isWithinAllowedHours(hoursStart, hoursEnd)) {
        console.log(`[execute-campaign] Campaign ${campaign.name} outside allowed hours (${hoursStart}-${hoursEnd}), skipping`);
        campResult.skipped_reason = `Fora do horário permitido (${hoursStart}-${hoursEnd})`;
        results.push(campResult);
        continue;
      }

      // --- Anti-ban: Check daily limit ---
      const dailyLimit = campaign.daily_limit || 200;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: sentToday } = await supabase
        .from("campaign_contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .in("status", ["sent", "delivered", "read"])
        .gte("sent_at", todayStart.toISOString());

      if ((sentToday || 0) >= dailyLimit) {
        console.log(`[execute-campaign] Campaign ${campaign.name} reached daily limit (${sentToday}/${dailyLimit}), skipping`);
        campResult.skipped_reason = `Limite diário atingido (${sentToday}/${dailyLimit})`;
        results.push(campResult);
        continue;
      }

      const remainingToday = dailyLimit - (sentToday || 0);

      // --- Anti-ban: Warmup logic ---
      let effectiveLimit = remainingToday;
      if (campaign.warmup_enabled) {
        const createdAt = new Date(campaign.created_at);
        const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (86400000));
        const warmupIncrement = campaign.warmup_daily_increment || 50;
        const warmupLimit = warmupIncrement * (daysSinceCreation + 1);
        effectiveLimit = Math.min(remainingToday, warmupLimit);
        console.log(`[execute-campaign] Warmup: day ${daysSinceCreation + 1}, limit ${warmupLimit}, effective ${effectiveLimit}`);
      }

      // --- Determine connection (direct, no HTTP) ---
      const connection = await resolveConnection(supabase, campaign.connection_id);
      if (!connection) {
        console.warn("[execute-campaign] No active WhatsApp connections");
        campResult.skipped_reason = "Nenhuma conexão WhatsApp ativa";
        results.push(campResult);
        continue;
      }

      console.log(`[execute-campaign] Using connection: ${connection.id} (${connection.name})`);
      console.log(`[execute-campaign] Processing campaign: ${campaign.name} (${campaign.id})`);

      const now = new Date().toISOString();
      const { data: pendingContacts, error: pcError } = await supabase
        .from("campaign_contacts")
        .select("id, contact_id, status, retry_count, next_retry_at, contacts(id, name, phone, whatsapp_lid)")
        .eq("campaign_id", campaign.id)
        .or(`status.eq.pending,and(status.eq.failed,next_retry_at.lte.${now})`)
        .order("created_at", { ascending: true })
        .limit(Math.min(50, effectiveLimit));

      if (pcError) {
        console.error(`[execute-campaign] Error fetching contacts for ${campaign.id}:`, pcError.message);
        campResult.failed++;
        results.push(campResult);
        continue;
      }

      if (!pendingContacts || pendingContacts.length === 0) {
        console.log(`[execute-campaign] No pending contacts for campaign ${campaign.name}`);
        const { count: totalPending } = await supabase
          .from("campaign_contacts")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "pending");

        if (totalPending === 0) {
          const { count: retryPending } = await supabase
            .from("campaign_contacts")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "failed")
            .not("next_retry_at", "is", null);

          if (!retryPending || retryPending === 0) {
            await supabase
              .from("campaigns")
              .update({ status: "completed", updated_at: new Date().toISOString() })
              .eq("id", campaign.id);
            campResult.completed = true;
            console.log(`[execute-campaign] Campaign ${campaign.name} completed!`);
          }
        }
        results.push(campResult);
        continue;
      }

      const pendingIds = pendingContacts.map((pc) => pc.id);
      const { data: claimedContacts, error: claimError } = await supabase
        .from("campaign_contacts")
        .update({ status: "sending" })
        .in("id", pendingIds)
        .in("status", ["pending", "failed"])
        .select("id");

      if (claimError) {
        console.error(`[execute-campaign] Error claiming contacts for ${campaign.id}:`, claimError.message);
        campResult.failed++;
        results.push(campResult);
        continue;
      }

      const claimedIds = new Set((claimedContacts || []).map((row) => row.id));
      let contactsToProcess = pendingContacts.filter((pc) => claimedIds.has(pc.id));

      if (contactsToProcess.length === 0) {
        console.log(`[execute-campaign] No contacts claimed for campaign ${campaign.name}; another worker may be processing them`);
        results.push(campResult);
        continue;
      }

      console.log(`[execute-campaign] ${contactsToProcess.length} contacts claimed for processing`);

      const minInterval = (campaign.min_interval || 30) * 1000;
      const maxInterval = (campaign.max_interval || 60) * 1000;
      const variations = campaign.message_variations || [];
      const useVariations = campaign.use_variations && variations.length > 0;
      const maxConsecutiveFailures = campaign.max_consecutive_failures || 5;
      const longPauseEvery = campaign.long_pause_every || 0;
      const longPauseMinutes = campaign.long_pause_minutes || 10;
      let consecutiveFailures = 0;
      let messagesSentInBatch = 0;
      const processedDestinations = new Set<string>();

      // Shuffle contacts if enabled
      if (campaign.shuffle_contacts) {
        for (let i = contactsToProcess.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [contactsToProcess[i], contactsToProcess[j]] = [contactsToProcess[j], contactsToProcess[i]];
        }
        console.log("[execute-campaign] Contacts shuffled");
      }

      for (const pc of contactsToProcess) {
        // --- Anti-ban: Check consecutive failures ---
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.warn(`[execute-campaign] ${consecutiveFailures} consecutive failures, auto-pausing campaign ${campaign.name}`);
          await supabase
            .from("campaigns")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .eq("id", campaign.id);
          campResult.skipped_reason = `Pausada por ${consecutiveFailures} falhas consecutivas`;
          break;
        }

        campResult.processed++;
        // deno-lint-ignore no-explicit-any
        const contact = pc.contacts as any;
        if (!contact || (!contact.phone && !contact.whatsapp_lid)) {
          console.warn(`[execute-campaign] Contact ${pc.contact_id} has no phone`);
          await supabase
            .from("campaign_contacts")
            .update({ status: "failed", last_error: "Contato sem telefone" })
            .eq("id", pc.id);
          campResult.failed++;
          consecutiveFailures++;
          continue;
        }

        const destinationKey = normalizeDestination(contact.phone) || normalizeDestination(contact.whatsapp_lid) || `contact:${pc.contact_id}`;
        if (processedDestinations.has(destinationKey)) {
          console.warn(`[execute-campaign] Duplicate destination skipped for campaign ${campaign.name}: ${destinationKey}`);
          await supabase
            .from("campaign_contacts")
            .update({
              status: "failed",
              next_retry_at: null,
              last_error: "Destino duplicado na campanha",
            })
            .eq("id", pc.id);
          campResult.failed++;
          continue;
        }
        processedDestinations.add(destinationKey);

        let messageContent = campaign.message;
        if (useVariations) {
          const allMessages = [campaign.message, ...variations];
          messageContent = allMessages[Math.floor(Math.random() * allMessages.length)];
        }
        messageContent = substituteVariables(messageContent, { name: contact.name, phone: contact.phone });

        try {
          // --- Resolve or create conversation ---
          let conversationId: string | null = null;
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
            const convUpdate: Record<string, unknown> = { campaign_id: campaign.id };
            if (campaign.flow_id) {
              convUpdate.active_flow_id = campaign.flow_id;
              convUpdate.is_bot_active = true;
            }
            await supabase.from("conversations").update(convUpdate).eq("id", conversationId);
          } else {
            const newConvData: Record<string, unknown> = {
              contact_id: contact.id,
              connection_id: connection.id,
              status: "in_progress",
              channel: "whatsapp",
              campaign_id: campaign.id,
              is_bot_active: !!campaign.flow_id,
              active_flow_id: campaign.flow_id || null,
            };
            const { data: newConv, error: newConvError } = await supabase
              .from("conversations")
              .insert(newConvData)
              .select("id")
              .single();
            if (newConvError) throw new Error(`Erro ao criar conversa: ${newConvError.message}`);
            conversationId = newConv.id;
          }

          // If agent is linked, set flow_state
          if (campaign.flow_id) {
            const { data: agentFlow } = await supabase
              .from("chatbot_flows")
              .select("config")
              .eq("id", campaign.flow_id)
              .single();

            // deno-lint-ignore no-explicit-any
            const agentCfg = agentFlow?.config as any;
            if (agentCfg?.aiEnabled) {
              await supabase.from("conversations").update({
                flow_state: {
                  flowId: campaign.flow_id,
                  awaitingAIResponse: true,
                  currentNodeId: "config-agent",
                  awaitingMenuResponse: false,
                  aiNodeData: {
                    systemPrompt: agentCfg.systemPrompt || "Você é um assistente virtual amigável.",
                    model: agentCfg.model || "google/gemini-2.5-flash",
                    temperature: agentCfg.temperature ?? 0.7,
                    maxTokens: agentCfg.maxTokens || 4096,
                  },
                },
              }).eq("id", conversationId);
            }
          }

          // --- DIRECT SEND (no HTTP loopback) ---
          const contactPhone = contact.phone;
          const contactLid = contact.whatsapp_lid;
          const isLidSend = !contactPhone && !!contactLid;
          const phoneToSend = contactPhone || contactLid;

          if (!phoneToSend) {
            throw new Error("Contato sem telefone ou LID");
          }

          const msgType = campaign.media_type && campaign.media_type !== "none" ? campaign.media_type : "text";

          const sendResult = await sendMessage({
            connection,
            phoneToSend,
            content: messageContent,
            messageType: msgType,
            mediaUrl: campaign.media_url || undefined,
            supabaseAdmin: supabase,
            isLidSend,
          });

          if (!sendResult.success) {
            throw new Error(sendResult.error || "Erro ao enviar mensagem");
          }

          // --- Save message to DB (like send-whatsapp does) ---
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            content: messageContent,
            sender_type: "agent",
            message_type: msgType,
            media_url: campaign.media_url || null,
            is_read: true,
          });

          // --- Update conversation timestamp (preserve bot state) ---
          await supabase.from("conversations").update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", conversationId);

          await supabase
            .from("campaign_contacts")
            .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
            .eq("id", pc.id);

          await supabase
            .from("campaigns")
            .update({ sent_count: (campaign.sent_count || 0) + campResult.sent + 1, updated_at: new Date().toISOString() })
            .eq("id", campaign.id);

          campResult.sent++;
          consecutiveFailures = 0;
          messagesSentInBatch++;
          console.log(`[execute-campaign] ✅ Sent to ${contact.name || contact.phone}`);

          if (campResult.processed < contactsToProcess.length) {
            if (longPauseEvery > 0 && messagesSentInBatch > 0 && messagesSentInBatch % longPauseEvery === 0) {
              const longPauseMs = longPauseMinutes * 60 * 1000;
              console.log(`[execute-campaign] Long pause: ${longPauseMinutes} min after ${messagesSentInBatch} messages`);
              await sleep(longPauseMs);
            } else {
              const waitMs = getRandomInterval(minInterval, maxInterval);
              console.log(`[execute-campaign] Waiting ${Math.round(waitMs / 1000)}s before next send`);
              await sleep(waitMs);
            }
          }
        } catch (sendErr) {
          const errorMsg = sendErr instanceof Error ? sendErr.message : "Erro desconhecido";
          console.error(`[execute-campaign] ❌ Error sending to ${contact.phone}: ${errorMsg}`);
          consecutiveFailures++;

          const retryCount = (pc.retry_count || 0) + 1;
          const maxRetries = 3;

          if (retryCount < maxRetries) {
            const nextRetry = getNextRetryTime(retryCount);
            await supabase
              .from("campaign_contacts")
              .update({ status: "failed", retry_count: retryCount, next_retry_at: nextRetry.toISOString(), last_error: errorMsg })
              .eq("id", pc.id);
            campResult.retried++;
          } else {
            await supabase
              .from("campaign_contacts")
              .update({ status: "failed", retry_count: retryCount, next_retry_at: null, last_error: `Falha após ${maxRetries} tentativas: ${errorMsg}` })
              .eq("id", pc.id);
            await supabase
              .from("campaigns")
              .update({ failed_count: (campaign.failed_count || 0) + 1, updated_at: new Date().toISOString() })
              .eq("id", campaign.id);
            campResult.failed++;
          }
        }
      }

      results.push(campResult);
      console.log(`[execute-campaign] Campaign ${campaign.name}: ${campResult.sent} sent, ${campResult.failed} failed, ${campResult.retried} retried`);
    }

    console.log(`[execute-campaign] Done processing ${results.length} campaigns`);
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[execute-campaign] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;
if (import.meta.main) Deno.serve(handler);
