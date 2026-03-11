import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  facebook: "#1877F2",
  telegram: "#0088cc",
  email: "#EA4335",
  web: "#6366F1",
  sms: "#F59E0B",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
  email: "E-mail",
  web: "Web",
  sms: "SMS",
};

function useChannelStats() {
  return useQuery({
    queryKey: ["channel-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("channel");

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        const ch = c.channel || "whatsapp";
        counts[ch] = (counts[ch] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([channel, count]) => ({
          name: CHANNEL_LABELS[channel] || channel,
          value: count,
          color: CHANNEL_COLORS[channel] || "#94A3B8",
        }))
        .sort((a, b) => b.value - a.value);
    },
    refetchInterval: 30000,
  });
}

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-semibold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function ChannelChart() {
  const { data: channelData, isLoading } = useChannelStats();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[250px] w-full rounded-lg" />
      </div>
    );
  }

  const total = channelData?.reduce((s, d) => s + d.value, 0) || 0;

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-lg">Conversas por Canal</h3>
        <span className="ml-auto text-xs text-muted-foreground">{total} total</span>
      </div>

      {!channelData || channelData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nenhuma conversa registrada
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={channelData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={renderCustomLabel}
              labelLine={false}
            >
              {channelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                name,
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
