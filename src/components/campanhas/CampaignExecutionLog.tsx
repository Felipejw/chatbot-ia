import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Send, CheckCircle2, Eye, XCircle, MessageSquare,
  Activity, Pause, Trash2, Clock, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogEntry {
  id: string;
  contactName: string;
  contactPhone: string | null;
  status: string;
  timestamp: string;
  error?: string | null;
}

interface CampaignExecutionLogProps {
  campaignId: string;
  campaignStatus: string;
}

const statusIcon: Record<string, React.ElementType> = {
  sending: Loader2,
  sent: Send,
  delivered: CheckCircle2,
  read: Eye,
  failed: XCircle,
  replied: MessageSquare,
  pending: Clock,
};

const statusLabel: Record<string, string> = {
  sending: "Enviando…",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falha",
  replied: "Respondida",
  pending: "Aguardando",
};

const statusColor: Record<string, string> = {
  sending: "text-warning",
  sent: "text-primary",
  delivered: "text-blue-500",
  read: "text-success",
  failed: "text-destructive",
  replied: "text-emerald-600",
  pending: "text-muted-foreground",
};

export function CampaignExecutionLog({ campaignId, campaignStatus }: CampaignExecutionLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveStats, setLiveStats] = useState({ sent: 0, delivered: 0, read: 0, failed: 0, replied: 0, pending: 0, total: 0 });
  const [isLive, setIsLive] = useState(campaignStatus === "active");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Initial load
  useEffect(() => {
    if (!campaignId) return;
    const load = async () => {
      const { data } = await supabase
        .from("campaign_contacts")
        .select("id, status, sent_at, delivered_at, read_at, replied_at, last_error, contact:contacts(name, phone)")
        .eq("campaign_id", campaignId)
        .order("sent_at", { ascending: false, nullsFirst: false });

      if (!data) return;

      const stats = { sent: 0, delivered: 0, read: 0, failed: 0, replied: 0, pending: 0, total: data.length };
      const entries: LogEntry[] = [];

      for (const row of data) {
        const s = (row as any).status || "pending";
        if (s === "pending") stats.pending++;
        else if (s === "sent" || s === "sending") stats.sent++;
        else if (s === "delivered") stats.delivered++;
        else if (s === "read") stats.read++;
        else if (s === "failed") stats.failed++;
        if ((row as any).replied_at) stats.replied++;

        const c = (row as any).contact as any;
        const ts = row.sent_at || (row as any).delivered_at || (row as any).read_at || (row as any).replied_at;
        if (ts || s === "failed") {
          entries.push({
            id: row.id,
            contactName: c?.name || "—",
            contactPhone: c?.phone || null,
            status: (row as any).replied_at ? "replied" : s,
            timestamp: ts || new Date().toISOString(),
            error: row.last_error,
          });
        }
      }

      setLiveStats(stats);
      setLogs(entries.slice(0, 200));
    };
    load();
  }, [campaignId]);

  // Realtime subscription
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`exec-log-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_contacts",
          filter: `campaign_id=eq.${campaignId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;

          // Fetch contact info
          const { data: contactRow } = await supabase
            .from("campaign_contacts")
            .select("contact:contacts(name, phone)")
            .eq("id", row.id)
            .maybeSingle();

          const c = (contactRow as any)?.contact as any;
          const s = row.status || "pending";
          const ts = row.sent_at || row.delivered_at || row.read_at || row.replied_at || new Date().toISOString();

          const entry: LogEntry = {
            id: row.id,
            contactName: c?.name || "—",
            contactPhone: c?.phone || null,
            status: row.replied_at ? "replied" : s,
            timestamp: ts,
            error: row.last_error,
          };

          setLogs((prev) => {
            const filtered = prev.filter((l) => l.id !== entry.id);
            return [entry, ...filtered].slice(0, 200);
          });

          // Update stats
          setLiveStats((prev) => {
            const newStats = { ...prev };
            if (payload.eventType === "INSERT") {
              newStats.total++;
              newStats.pending++;
            }
            if (payload.eventType === "UPDATE") {
              const oldStatus = (payload.old as any)?.status;
              if (oldStatus === "pending") newStats.pending = Math.max(0, newStats.pending - 1);
              else if (oldStatus === "sent" || oldStatus === "sending") newStats.sent = Math.max(0, newStats.sent - 1);
              else if (oldStatus === "delivered") newStats.delivered = Math.max(0, newStats.delivered - 1);
              else if (oldStatus === "read") newStats.read = Math.max(0, newStats.read - 1);
              else if (oldStatus === "failed") newStats.failed = Math.max(0, newStats.failed - 1);
            }
            if (s === "sent" || s === "sending") newStats.sent++;
            else if (s === "delivered") newStats.delivered++;
            else if (s === "read") newStats.read++;
            else if (s === "failed") newStats.failed++;
            if (row.replied_at && !(payload.old as any)?.replied_at) newStats.replied++;
            return newStats;
          });
        }
      )
      .subscribe();

    setIsLive(true);

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [campaignId]);

  const processed = liveStats.sent + liveStats.delivered + liveStats.read + liveStats.failed;
  const progressPct = liveStats.total > 0 ? Math.round((processed / liveStats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Live status bar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className={cn("w-4 h-4", isLive && campaignStatus === "active" ? "text-success animate-pulse" : "text-muted-foreground")} />
              Execução em Tempo Real
            </CardTitle>
            {isLive && campaignStatus === "active" && (
              <Badge variant="outline" className="text-success border-success gap-1 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-success inline-block" />
                AO VIVO
              </Badge>
            )}
            {campaignStatus === "paused" && (
              <Badge variant="outline" className="text-warning border-warning gap-1">
                <Pause className="w-3 h-3" />
                PAUSADA
              </Badge>
            )}
            {campaignStatus === "completed" && (
              <Badge variant="outline" className="text-primary border-primary gap-1">
                <CheckCircle2 className="w-3 h-3" />
                CONCLUÍDA
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{processed} / {liveStats.total} ({progressPct}%)</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-success"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Live counters */}
          <div className="grid grid-cols-6 gap-2">
            {[
              { label: "Aguardando", value: liveStats.pending, icon: Clock, color: "text-muted-foreground" },
              { label: "Enviadas", value: liveStats.sent, icon: Send, color: "text-primary" },
              { label: "Entregues", value: liveStats.delivered, icon: CheckCircle2, color: "text-blue-500" },
              { label: "Lidas", value: liveStats.read, icon: Eye, color: "text-success" },
              { label: "Respondidas", value: liveStats.replied, icon: MessageSquare, color: "text-emerald-600" },
              { label: "Falhas", value: liveStats.failed, icon: XCircle, color: "text-destructive" },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
                <s.icon className={cn("w-4 h-4 mx-auto mb-1", s.color)} />
                <p className={cn("text-lg font-bold tabular-nums", s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity log feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log de Atividade</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[350px]" ref={scrollRef}>
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma atividade registrada ainda</p>
                {campaignStatus === "draft" && (
                  <p className="text-xs mt-1">Inicie o disparo para ver os logs aqui</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((log) => {
                  const Icon = statusIcon[log.status] || Clock;
                  return (
                    <div key={`${log.id}-${log.status}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className={cn("mt-0.5 shrink-0", statusColor[log.status] || "text-muted-foreground")}>
                        <Icon className={cn("w-4 h-4", log.status === "sending" && "animate-spin")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{log.contactName}</span>
                          {log.contactPhone && (
                            <span className="text-xs text-muted-foreground">{log.contactPhone}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-xs font-medium", statusColor[log.status])}>
                            {statusLabel[log.status] || log.status}
                          </span>
                          {log.error && (
                            <span className="text-xs text-destructive truncate max-w-[200px]" title={log.error}>
                              — {log.error}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {format(new Date(log.timestamp), "HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
