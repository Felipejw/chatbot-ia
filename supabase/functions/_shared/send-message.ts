// Shared module: Baileys + Meta API sending logic
// Used by both send-whatsapp (HTTP handler) and execute-campaign (direct call)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_URL = "https://graph.facebook.com/v18.0";

interface SessionData {
  sessionName?: string;
  token?: string;
  instanceName?: string;
  engine?: string;
  access_token?: string;
  phone_number_id?: string;
}

interface Connection {
  id: string;
  type: string;
  status: string;
  session_data: SessionData | null;
  name: string;
  is_default: boolean;
}

export interface SendMessageOptions {
  connection: Connection;
  phoneToSend: string;
  content: string;
  messageType: string;
  mediaUrl?: string;
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any;
  isLidSend?: boolean;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ========== Baileys Send ==========
async function sendViaBaileys(
  opts: SendMessageOptions
): Promise<SendResult> {
  const { connection, phoneToSend, content, messageType, mediaUrl, supabaseAdmin, isLidSend } = opts;

  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "baileys_server_url")
    .single();

  const { data: apiKeySettings } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "baileys_api_key")
    .single();

  const baileysUrl = settings?.value;
  const baileysApiKey = apiKeySettings?.value;

  if (!baileysUrl) {
    return { success: false, error: "Baileys server URL not configured" };
  }

  const sessionData = connection.session_data;
  const sessionName = sessionData?.sessionName || connection.name.toLowerCase().replace(/\s+/g, "_");

  console.log(`[send-message] Using session: ${sessionName}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (baileysApiKey) {
    headers["X-API-Key"] = baileysApiKey;
  }

  let formattedNumber: string;
  if (isLidSend) {
    formattedNumber = `${phoneToSend.replace(/\D/g, "")}@lid`;
    console.log(`[send-message] Sending to LID: ${formattedNumber}`);
  } else {
    formattedNumber = phoneToSend.replace(/\D/g, "");
    if (!formattedNumber.startsWith("55") && formattedNumber.length <= 11) {
      formattedNumber = "55" + formattedNumber;
    }
    console.log(`[send-message] Sending to phone: ${formattedNumber}`);
  }

  let response;

  if (mediaUrl && messageType !== "text") {
    response = await fetch(`${baileysUrl}/sessions/${sessionName}/send/media`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: formattedNumber,
        mediaUrl,
        caption: content,
        mediaType: messageType,
      }),
    });
  } else {
    response = await fetch(`${baileysUrl}/sessions/${sessionName}/send/text`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: formattedNumber,
        text: content,
      }),
    });
  }

  const result = await response.json();
  console.log("[send-message] Baileys response:", JSON.stringify(result));

  if (!result.success) {
    return { success: false, error: result.error || "Failed to send message" };
  }

  return { success: true, messageId: result.data?.messageId };
}

// ========== Meta API Send ==========
async function sendViaMetaAPI(
  opts: SendMessageOptions
): Promise<SendResult> {
  const { connection, phoneToSend, content, messageType, mediaUrl } = opts;
  const sessionData = connection.session_data;

  if (!sessionData?.access_token || !sessionData?.phone_number_id) {
    return { success: false, error: "Meta API credentials not configured" };
  }

  const formattedTo = phoneToSend.replace(/[^\d]/g, "");

  let payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedTo,
    type: "text",
  };

  if (messageType === "image" && mediaUrl) {
    payload.type = "image";
    payload.image = { link: mediaUrl, caption: content };
  } else if (messageType === "video" && mediaUrl) {
    payload.type = "video";
    payload.video = { link: mediaUrl, caption: content };
  } else if (messageType === "audio" && mediaUrl) {
    payload.type = "audio";
    payload.audio = { link: mediaUrl };
  } else if (messageType === "document" && mediaUrl) {
    payload.type = "document";
    payload.document = { link: mediaUrl, caption: content };
  } else {
    payload.type = "text";
    payload.text = { body: content, preview_url: true };
  }

  console.log("[send-message] Meta API payload:", JSON.stringify(payload));

  const response = await fetch(
    `${META_API_URL}/${sessionData.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("[send-message] Meta API error:", result);
    return { success: false, error: result.error?.message || "Failed to send message" };
  }

  console.log("[send-message] Meta API success:", result);
  return { success: true, messageId: result.messages?.[0]?.id };
}

// ========== Unified Send ==========
export async function sendMessage(opts: SendMessageOptions): Promise<SendResult> {
  const engine = opts.connection.session_data?.engine || "baileys";
  const isMeta = engine === "meta" || !!opts.connection.session_data?.access_token;

  if (isMeta) {
    return sendViaMetaAPI(opts);
  } else {
    return sendViaBaileys(opts);
  }
}

// ========== Resolve Connection ==========
// deno-lint-ignore no-explicit-any
export async function resolveConnection(supabaseAdmin: any, connectionId?: string | null): Promise<Connection | null> {
  if (connectionId) {
    const { data } = await supabaseAdmin
      .from("connections")
      .select("*")
      .eq("id", connectionId)
      .single();
    if (data) return data as Connection;
  }

  // Default connected
  const { data: defaultConn } = await supabaseAdmin
    .from("connections")
    .select("*")
    .eq("is_default", true)
    .eq("status", "connected")
    .limit(1)
    .single();
  if (defaultConn) return defaultConn as Connection;

  // Any connected
  const { data: anyConn } = await supabaseAdmin
    .from("connections")
    .select("*")
    .eq("status", "connected")
    .limit(1)
    .single();
  if (anyConn) return anyConn as Connection;

  return null;
}
