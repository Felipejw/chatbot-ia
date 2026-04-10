import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string | null;
  trigger_value: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useFlows() {
  return useQuery({
    queryKey: ["chatbot-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chatbot_flows" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ChatbotFlow[];
    },
  });
}

export function useFlow(id: string | null) {
  return useQuery({
    queryKey: ["chatbot-flow", id],
    queryFn: async () => {
      if (!id) return null;

      const { data: flow, error } = await supabase
        .from("chatbot_flows" as any)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      return {
        flow: flow as unknown as ChatbotFlow,
      };
    },
    enabled: !!id,
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: flow, error } = await supabase
        .from("chatbot_flows" as any)
        .insert({
          name: data.name,
          description: data.description || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return flow as unknown as ChatbotFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Agente criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar agente: " + error.message);
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      is_active?: boolean;
    }) => {
      const { data: updated, error } = await supabase
        .from("chatbot_flows" as any)
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated as unknown as ChatbotFlow;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      queryClient.invalidateQueries({ queryKey: ["chatbot-flow", variables.id] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar agente: " + error.message);
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chatbot_flows" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Agente excluído!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir agente: " + error.message);
    },
  });
}
