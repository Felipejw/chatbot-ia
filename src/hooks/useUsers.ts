// Stub: original module was removed during refactoring
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...updates }: { userId: string; [key: string]: unknown }) => {
      const { data, error } = await supabase.from('profiles').update(updates).eq('user_id', userId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
