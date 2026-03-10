import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserPermission {
  id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

export const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'tags', label: 'Tags' },
  { key: 'campanhas', label: 'Disparo em Massa' },
  { key: 'chatbot', label: 'Agentes de IA' },
  { key: 'setores', label: 'Setores' },
  { key: 'integracoes', label: 'Integrações' },
  { key: 'conexoes', label: 'Conexões' },
] as const;

export type ModuleKey = typeof MODULES[number]['key'];

// Map routes to module keys
export const ROUTE_TO_MODULE: Record<string, ModuleKey> = {
  '/dashboard': 'dashboard',
  '/atendimento': 'atendimento',
  '/tags': 'tags',
  '/campanhas': 'campanhas',
  '/chatbot': 'chatbot',
  '/flow-builder': 'chatbot',
  '/filas-chatbot': 'setores',
  '/integracoes': 'integracoes',
  '/conexoes': 'conexoes',
};

export function useUserPermissions(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!userId,
  });
}

export function useUpdatePermissions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      permissions 
    }: { 
      userId: string; 
      permissions: Array<{ module: string; can_view: boolean; can_edit: boolean }> 
    }) => {
      // Delete existing permissions for this user
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;
      
      // Insert new permissions
      if (permissions.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(
            permissions.map(p => ({
              user_id: userId,
              module: p.module,
              can_view: p.can_view,
              can_edit: p.can_edit,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      toast.success('Permissões atualizadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar permissões: ' + error.message);
    },
  });
}

export function useMyPermissions() {
  return useQuery({
    queryKey: ['my-permissions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserPermission[];
    },
  });
}
