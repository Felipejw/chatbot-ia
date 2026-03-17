// ===========================================
// Execute Campaign - Disparo de campanhas em massa
// Suporta variações, intervalos, retry com backoff
// Anti-ban: daily_limit, allowed_hours, consecutive failures
// ===========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

      // --- Determine connection ---
      let connectionId = campaign.connection_id;
      if (!connectionId) {
        const { data: connections } = await supabase
          .from("connections")
          .select("id")
          .eq("status", "connected")
          .limit(1);
        if (!connections || connections.length === 0) {
          console.warn("[execute-campaign] No active WhatsApp connections");
          campResult.skipped_reason = "Nenhuma conexão WhatsApp ativa";
          results.push(campResult);
          continue;
        }
        connectionId = connections[0].id;
      }

      console.log(`[execute-campaign] Processing campaign: ${campaign.name} (${campaign.id})`);

      const now = new Date().toISOString();
      const { data: pendingContacts, error: pcError } = await supabase
        .from("campaign_contacts")
        .select("id, contact_id, status, retry_count, next_retry_at, contacts(id, name, phone, whatsapp_lid)")
        .eq("campaign_id", campaign.id)
        .or(`status.eq.pending,and(status.eq.failed,next_retry_at.lte.${now})`)
        .order("created_at", { ascending: true })
        .limit(Math.min(50, remainingToday));

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

      console.log(`[execute-campaign] ${pendingContacts.length} contacts to process`);

      const minInterval = (campaign.min_interval || 30) * 1000;
      const maxInterval = (campaign.max_interval || 60) * 1000;
      const variations = campaign.message_variations || [];
      const useVariations = campaign.use_variations && variations.length > 0;
      const maxConsecutiveFailures = campaign.max_consecutive_failures || 5;
      let consecutiveFailures = 0;

      for (const pc of pendingContacts) {
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

        let messageContent = campaign.message;
        if (useVariations) {
          const allMessages = [campaign.message, ...variations];
          messageContent = allMessages[Math.floor(Math.random() * allMessages.length)];
        }
        messageContent = substituteVariables(messageContent, { name: contact.name, phone: contact.phone });

        try {
          await supabase.from("campaign_contacts").update({ status: "sending" }).eq("id", pc.id);

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
          } else {
            const { data: newConv, error: newConvError } = await supabase
              .from("conversations")
              .insert({ contact_id: contact.id, connection_id: connectionId, status: "in_progress", channel: "whatsapp", is_bot_active: false })
              .select("id")
              .single();
            if (newConvError) throw new Error(`Erro ao criar conversa: ${newConvError.message}`);
            conversationId = newConv.id;
          }

          const { error: sendError } = await supabase.functions.invoke("send-whatsapp", {
            body: {
              conversationId,
              content: messageContent,
              messageType: campaign.media_type && campaign.media_type !== "none" ? campaign.media_type : "text",
              mediaUrl: campaign.media_url || undefined,
            },
          });

          if (sendError) throw new Error(sendError.message || "Erro ao enviar mensagem");

          await supabase
            .from("campaign_contacts")
            .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
            .eq("id", pc.id);

          await supabase
            .from("campaigns")
            .update({ sent_count: (campaign.sent_count || 0) + campResult.sent + 1, updated_at: new Date().toISOString() })
            .eq("id", campaign.id);

          campResult.sent++;
          consecutiveFailures = 0; // Reset on success
          console.log(`[execute-campaign] Sent to ${contact.name || contact.phone}`);

          if (campResult.processed < pendingContacts.length) {
            const waitMs = getRandomInterval(minInterval, maxInterval);
            console.log(`[execute-campaign] Waiting ${Math.round(waitMs / 1000)}s before next send`);
            await sleep(waitMs);
          }
        } catch (sendErr) {
          const errorMsg = sendErr instanceof Error ? sendErr.message : "Erro desconhecido";
          console.error(`[execute-campaign] Error sending to ${contact.phone}: ${errorMsg}`);
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
