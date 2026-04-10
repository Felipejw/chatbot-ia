import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMessage, resolveConnection } from "../_shared/send-message.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessagePayload {
  conversationId: string;
  content: string;
  messageType?: "text" | "image" | "audio" | "document" | "video";
  mediaUrl?: string;
  preserveBotState?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: missing token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !userData?.user) {
      console.error("[send-whatsapp] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log(`[send-whatsapp] Authenticated user: ${userId}`);

    // 2. Parse payload
    const payload: SendMessagePayload = await req.json();
    const { conversationId, content, messageType = "text", mediaUrl } = payload;

    if (!conversationId || !content) {
      return new Response(
        JSON.stringify({ success: false, error: "conversationId and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp] Sending to conversation: ${conversationId}, type: ${messageType}`);

    // 3. Get conversation with contact
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("[send-whatsapp] Conversation not found:", convError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const contact = (conversation as any).contacts;
    if (!contact) {
      return new Response(
        JSON.stringify({ success: false, error: "Contact not found for conversation" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp] Contact: ${contact.name} | Phone: ${contact.phone} | LID: ${contact.whatsapp_lid}`);

    // 4. Determine connection
    const connection = await resolveConnection(supabaseAdmin, conversation.connection_id);

    if (!connection) {
      return new Response(
        JSON.stringify({ success: false, error: "No active WhatsApp connection available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp] Using connection: ${connection.id} (${connection.name})`);

    // 5. Determine phone/LID to send to
    const contactPhone = contact.phone;
    const contactLid = contact.whatsapp_lid;
    const isLidSend = !contactPhone && !!contactLid;
    const phoneToSend = contactPhone || contactLid;

    if (!phoneToSend) {
      return new Response(
        JSON.stringify({ success: false, error: "Contact has no phone number or WhatsApp LID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Send via shared module
    const sendResult = await sendMessage({
      connection,
      phoneToSend,
      content,
      messageType,
      mediaUrl,
      supabaseAdmin,
      isLidSend,
    });

    if (!sendResult.success) {
      console.error("[send-whatsapp] Send failed:", sendResult.error);
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp] Message sent successfully, ID: ${sendResult.messageId}`);

    // 7. Save message to database
    const { data: savedMessage, error: msgError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content: content,
        sender_id: userId,
        sender_type: "agent",
        message_type: messageType,
        media_url: mediaUrl || null,
        is_read: true,
      })
      .select()
      .single();

    if (msgError) {
      console.error("[send-whatsapp] Error saving message:", msgError.message);
    } else {
      console.log(`[send-whatsapp] Message saved: ${savedMessage.id}`);
    }

    // 8. Update conversation
    const preserveBotState = payload.preserveBotState === true;
    const convUpdate: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!preserveBotState) {
      convUpdate.is_bot_active = false;
    }
    await supabaseAdmin
      .from("conversations")
      .update(convUpdate)
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendResult.messageId,
        savedMessageId: savedMessage?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-whatsapp:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;
if (import.meta.main) Deno.serve(handler);
