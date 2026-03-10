// Stub: original module was removed during refactoring
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string;
  message: string;
  category: string | null;
}

export function useQuickReplies() {
  return useQuery({
    queryKey: ['quick-replies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('quick_replies').select('*').order('title');
      if (error) throw error;
      return data as QuickReply[];
    },
  });
}
