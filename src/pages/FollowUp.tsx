import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, MessageSquare, XCircle, Clock, TrendingUp, Play, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useFollowUpMetrics } from "@/hooks/useFollowUpMetrics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function MetricCard({ title, value, icon: Icon, description, color }: {
  title: string; value: string | number; icon: React.ElementType; description?: string; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function FollowUp() {
  const { statusCounts, dailyVolume, agentEffectiveness, isLoading } = useFollowUpMetrics();
  const [processing, setProcessing] = useState(false);

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-follow-ups", {
        body: { time: new Date().toISOString() },
      });
      if (error) throw error;
      toast.success(`Processado: ${data?.processed || 0} enviados de ${data?.total || 0} pendentes`);
    } catch (err) {
      toast.error("Erro ao processar follow-ups: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const counts = statusCounts || { sent: 0, replied: 0, cancelled: 0, pending: 0, responseRate: 0 };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <PageHeader
          icon={TrendingUp}
          title="Follow-up"
          description="Métricas e acompanhamento dos follow-ups automáticos"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleProcessNow}
          disabled={processing}
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          Processar agora
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Enviados" value={counts.sent} icon={Send} color="text-blue-500" />
        <MetricCard title="Respondidos" value={counts.replied} icon={MessageSquare} color="text-emerald-500" />
        <MetricCard
          title="Taxa de Resposta"
          value={`${counts.responseRate}%`}
          icon={TrendingUp}
          color="text-primary"
          description={`${counts.replied} de ${counts.sent} respondidos`}
        />
        <MetricCard title="Cancelados" value={counts.cancelled} icon={XCircle} color="text-destructive" />
        <MetricCard title="Pendentes" value={counts.pending} icon={Clock} color="text-amber-500" />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviados vs Respondidos (últimos 7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyVolume && dailyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Bar dataKey="sent" name="Enviados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replied" name="Respondidos" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum dado disponível nos últimos 7 dias
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agent Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de Efetividade por Agente</CardTitle>
        </CardHeader>
        <CardContent>
          {agentEffectiveness && agentEffectiveness.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Respondidos</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentEffectiveness.map((agent, idx) => (
                  <TableRow key={agent.flowId}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>{agent.flowName}</TableCell>
                    <TableCell className="text-right">{agent.sent}</TableCell>
                    <TableCell className="text-right">{agent.replied}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={agent.rate >= 50 ? "default" : agent.rate >= 25 ? "secondary" : "outline"}
                      >
                        {agent.rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum agente com dados de follow-up ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
