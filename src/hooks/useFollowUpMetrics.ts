import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

interface StatusCounts {
  sent: number;
  replied: number;
  cancelled: number;
  pending: number;
  responseRate: number;
}

interface DailyVolume {
  date: string;
  sent: number;
  replied: number;
}

interface AgentEffectiveness {
  flowId: string;
  flowName: string;
  sent: number;
  replied: number;
  rate: number;
}

export function useFollowUpMetrics() {
  const statusCounts = useQuery({
    queryKey: ["follow-up-metrics-counts"],
    queryFn: async (): Promise<StatusCounts> => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("status");
      if (error) throw error;

      const rows = data || [];
      const sent = rows.filter((r) => r.status === "sent").length;
      const replied = rows.filter((r) => r.status === "replied").length;
      const cancelled = rows.filter((r) => r.status === "cancelled").length;
      const pending = rows.filter((r) => r.status === "pending").length;
      return {
        sent,
        replied,
        cancelled,
        pending,
        responseRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      };
    },
    staleTime: 30000,
    retry: 1,
  });

  const dailyVolume = useQuery({
    queryKey: ["follow-up-metrics-daily"],
    queryFn: async (): Promise<DailyVolume[]> => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from("follow_ups")
        .select("status, sent_at, created_at")
        .gte("created_at", sevenDaysAgo)
        .in("status", ["sent", "replied"]);
      if (error) throw error;

      const dayMap: Record<string, { sent: number; replied: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        dayMap[d] = { sent: 0, replied: 0 };
      }

      for (const row of data || []) {
        const dateKey = format(new Date(row.sent_at || row.created_at), "yyyy-MM-dd");
        if (dayMap[dateKey]) {
          if (row.status === "sent") dayMap[dateKey].sent++;
          if (row.status === "replied") dayMap[dateKey].replied++;
        }
      }

      return Object.entries(dayMap).map(([date, v]) => ({
        date: format(new Date(date), "dd/MM"),
        ...v,
      }));
    },
    staleTime: 30000,
  });

  const agentEffectiveness = useQuery({
    queryKey: ["follow-up-metrics-agents"],
    queryFn: async (): Promise<AgentEffectiveness[]> => {
      const { data: followUps, error } = await supabase
        .from("follow_ups")
        .select("flow_id, status")
        .in("status", ["sent", "replied"])
        .not("flow_id", "is", null);
      if (error) throw error;

      const flowMap: Record<string, { sent: number; replied: number }> = {};
      for (const row of followUps || []) {
        if (!row.flow_id) continue;
        if (!flowMap[row.flow_id]) flowMap[row.flow_id] = { sent: 0, replied: 0 };
        if (row.status === "sent") flowMap[row.flow_id].sent++;
        if (row.status === "replied") flowMap[row.flow_id].replied++;
      }

      const flowIds = Object.keys(flowMap);
      if (flowIds.length === 0) return [];

      const { data: flows } = await supabase
        .from("chatbot_flows")
        .select("id, name")
        .in("id", flowIds);

      const flowNameMap: Record<string, string> = {};
      for (const f of flows || []) flowNameMap[f.id] = f.name;

      return flowIds
        .map((id) => ({
          flowId: id,
          flowName: flowNameMap[id] || "Agente desconhecido",
          sent: flowMap[id].sent,
          replied: flowMap[id].replied,
          rate: flowMap[id].sent > 0 ? Math.round((flowMap[id].replied / flowMap[id].sent) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate);
    },
    staleTime: 30000,
  });

  return {
    statusCounts: statusCounts.data,
    dailyVolume: dailyVolume.data,
    agentEffectiveness: agentEffectiveness.data,
    isLoading: statusCounts.isLoading || dailyVolume.isLoading || agentEffectiveness.isLoading,
  };
}
