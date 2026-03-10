import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FollowUp {
  id: string;
  conversation_id: string;
  contact_id: string;
  connection_id: string | null;
  flow_id: string | null;
  step: number;
  max_steps: number;
  interval_minutes: number;
  mode: string;
  status: string;
  message_content: string | null;
  follow_up_prompt: string | null;
  fixed_messages: string[];
  final_action: string;
  transfer_queue_id: string | null;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFollowUps(conversationId?: string) {
  const queryClient = useQueryClient();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ["follow-ups", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("follow_ups" as any)
        .select("*")
        .eq("conversation_id", conversationId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FollowUp[];
    },
    enabled: !!conversationId,
  });

  const pendingFollowUps = followUps?.filter((f) => f.status === "pending") || [];
  const nextFollowUp = pendingFollowUps[0] || null;

  const cancelFollowUp = useMutation({
    mutationFn: async (followUpId: string) => {
      const { error } = await supabase
        .from("follow_ups" as any)
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", followUpId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-ups", conversationId] });
    },
  });

  const cancelAllPending = useMutation({
    mutationFn: async (convId: string) => {
      const { error } = await supabase
        .from("follow_ups" as any)
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("conversation_id", convId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });

  return {
    followUps: followUps || [],
    pendingFollowUps,
    nextFollowUp,
    isLoading,
    cancelFollowUp,
    cancelAllPending,
  };
}
