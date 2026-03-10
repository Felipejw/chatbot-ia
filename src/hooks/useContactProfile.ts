// Stub: original module was removed during refactoring
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContactProfile(contactId: string) {
  return useQuery({
    queryKey: ['contact-profile', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, contact_tags(tag_id, tags(*))')
        .eq('id', contactId)
        .single();
      if (error) throw error;
      const tags = (data.contact_tags || []).map((ct: any) => ct.tags).filter(Boolean);
      return { ...data, tags };
    },
    enabled: !!contactId,
  });
}

export function useContactConversationHistory(contactId: string) {
  return useQuery({
    queryKey: ['contact-conversation-history', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}

export function useUpdateContactNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, notes }: { contactId: string; notes: string }) => {
      const { error } = await supabase.from('contacts').update({ notes }).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ['contact-profile', vars.contactId] }),
  });
}

export function useFetchWhatsAppProfilePicture() {
  return useMutation({
    mutationFn: async ({ contactId }: { contactId: string }) => {
      // No-op stub
      return { contactId };
    },
  });
}
