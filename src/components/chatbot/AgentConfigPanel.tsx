import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Save, Loader2, Settings, Zap, Brain, MessageCircle, ArrowRightLeft, XCircle, RotateCcw, Plus, Trash2, Clock, Calendar, Thermometer, Image, Video, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFlow, useFlows, type ChatbotFlow } from "@/hooks/useFlows";
import { useQueues } from "@/hooks/useQueues";
import { useUsers } from "@/hooks/useUsers";
import { useWhatsAppConnections } from "@/hooks/useWhatsAppConnections";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FollowUpStep {
  interval: number;
  unit: "minutes" | "hours" | "days";
  message: string;
  mode: "ai" | "fixed";
}

interface AgentConfig {
  // Trigger
  triggerType: string;
  triggerValue: string;
  // AI
  aiEnabled: boolean;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  knowledgeBase: string;
  // WhatsApp
  connectionId: string;
  // Transfer
  transferEnabled: boolean;
  transferType: string;
  transferQueueId: string;
  transferAgentId: string;
  transferFlowId: string;
  // Follow-up
  followUpEnabled: boolean;
  followUpSteps: number;
  followUpIntervalMinutes: number;
  followUpMode: "ai" | "fixed";
  followUpMessages: string[];
  followUpPrompt: string;
  followUpFinalAction: "none" | "close" | "transfer";
  followUpTransferQueueId: string;
  // Follow-up advanced
  followUpStepConfigs: FollowUpStep[];
  followUpAllowedHoursStart: string;
  followUpAllowedHoursEnd: string;
  followUpAllowedDays: string[];
  followUpModel: string;
  followUpTemperature: number;
  followUpClosingMessage: string;
  followUpStopOnHumanAssign: boolean;
  // End
  endMessage: string;
  markResolved: boolean;
}

const defaultConfig: AgentConfig = {
  triggerType: "keyword",
  triggerValue: "",
  aiEnabled: true,
  model: "google/gemini-2.5-flash",
  systemPrompt: "Você é um assistente virtual amigável e prestativo.",
  temperature: 0.7,
  maxTokens: 500,
  knowledgeBase: "",
  connectionId: "",
  transferEnabled: false,
  transferType: "queue",
  transferQueueId: "",
  transferAgentId: "",
  transferFlowId: "",
  followUpEnabled: false,
  followUpSteps: 3,
  followUpIntervalMinutes: 60,
  followUpMode: "ai",
  followUpMessages: ["", "", ""],
  followUpPrompt: "Gere uma mensagem de acompanhamento amigável e natural para o contato que não respondeu.",
  followUpFinalAction: "none",
  followUpTransferQueueId: "",
  followUpStepConfigs: [
    { interval: 30, unit: "minutes", message: "", mode: "ai" },
    { interval: 2, unit: "hours", message: "", mode: "ai" },
    { interval: 24, unit: "hours", message: "", mode: "ai" },
  ],
  followUpAllowedHoursStart: "08:00",
  followUpAllowedHoursEnd: "20:00",
  followUpAllowedDays: ["mon", "tue", "wed", "thu", "fri"],
  followUpModel: "google/gemini-2.5-flash-lite",
  followUpTemperature: 0.8,
  followUpClosingMessage: "",
  followUpStopOnHumanAssign: true,
  endMessage: "",
  markResolved: true,
};

function getTotalCycleTime(steps: FollowUpStep[]): string {
  let totalMinutes = 0;
  for (const s of steps) {
    if (s.unit === "minutes") totalMinutes += s.interval;
    else if (s.unit === "hours") totalMinutes += s.interval * 60;
    else if (s.unit === "days") totalMinutes += s.interval * 1440;
  }
  if (totalMinutes < 60) return `${totalMinutes}min`;
  if (totalMinutes < 1440) return `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? `${totalMinutes % 60}min` : ""}`;
  const days = Math.floor(totalMinutes / 1440);
  const remainHours = Math.floor((totalMinutes % 1440) / 60);
  return `${days}d${remainHours > 0 ? `${remainHours}h` : ""}`;
}

interface AgentConfigPanelProps {
  flowId: string;
}

export function AgentConfigPanel({ flowId }: AgentConfigPanelProps) {
  const { data: flowData, isLoading } = useFlow(flowId);
  const { data: allFlows } = useFlows();
  const { data: queues } = useQueues();
  const { data: users } = useUsers();
  const { connections } = useWhatsAppConnections();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load data
  useEffect(() => {
    if (flowData?.flow) {
      const flow = flowData.flow;
      setName(flow.name);
      setDescription(flow.description || "");
      setIsActive(flow.is_active);

      const saved = (flow as any).config as Partial<AgentConfig> | null;
      if (saved && typeof saved === "object") {
        setConfig({ ...defaultConfig, ...saved });
      } else {
        setConfig({
          ...defaultConfig,
          triggerType: (flow as any).trigger_type || "keyword",
          triggerValue: (flow as any).trigger_value || "",
        });
      }
      setHasChanges(false);
    }
  }, [flowData]);

  const updateConfig = useCallback((partial: Partial<AgentConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("chatbot_flows" as any)
        .update({
          name,
          description: description || null,
          is_active: isActive,
          trigger_type: config.triggerType,
          trigger_value: config.triggerValue || null,
          config: config as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flowId);

      if (error) throw error;
      setHasChanges(false);
      toast.success("Agente salvo com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const otherFlows = allFlows?.filter((f) => f.id !== flowId) || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-muted/20">
      {/* Header */}
      <div className="p-4 border-b border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Configuração do Agente</h2>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {hasChanges ? "Salvar" : "Salvo"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <Accordion type="multiple" defaultValue={["general", "trigger", "ai", "followup", "transfer", "end"]} className="space-y-4">
            {/* === GERAL === */}
            <AccordionItem value="general" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Geral</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label>Nome do agente</Label>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
                    placeholder="Ex: Atendimento Vendas"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
                    placeholder="Descreva o objetivo deste agente..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Agente ativo</Label>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(v) => { setIsActive(v); setHasChanges(true); }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* === GATILHO === */}
            <AccordionItem value="trigger" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Gatilho</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label>Tipo de gatilho</Label>
                  <Select value={config.triggerType} onValueChange={(v) => updateConfig({ triggerType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Palavra-chave</SelectItem>
                      <SelectItem value="phrase">Frase exata</SelectItem>
                      <SelectItem value="new_conversation">Nova conversa</SelectItem>
                      <SelectItem value="all">Todas as mensagens</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.triggerType !== "new_conversation" && config.triggerType !== "all" && (
                  <div className="space-y-2">
                    <Label>Valor do gatilho</Label>
                    <Input
                      value={config.triggerValue}
                      onChange={(e) => updateConfig({ triggerValue: e.target.value })}
                      placeholder={config.triggerType === "keyword" ? "Ex: vendas, preço, comprar" : "Ex: Quero falar com vendas"}
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* === CONFIGURAÇÃO DA IA === */}
            <AccordionItem value="ai" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-500" />
                  <span className="font-medium">Configuração da IA</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <Label>IA habilitada</Label>
                  <Switch
                    checked={config.aiEnabled}
                    onCheckedChange={(v) => updateConfig({ aiEnabled: v })}
                  />
                </div>
                {config.aiEnabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={config.model} onValueChange={(v) => updateConfig({ model: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                          <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                          <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                          <SelectItem value="openai/gpt-5-nano">GPT-5 Nano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prompt do sistema</Label>
                      <Textarea
                        value={config.systemPrompt}
                        onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                        placeholder="Instruções para a IA..."
                        rows={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Temperatura: {config.temperature}</Label>
                      <Slider
                        value={[config.temperature]}
                        onValueChange={([v]) => updateConfig({ temperature: v })}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">
                        Menor = mais preciso, Maior = mais criativo
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Máximo de tokens</Label>
                      <Input
                        type="number"
                        value={config.maxTokens}
                        onChange={(e) => updateConfig({ maxTokens: parseInt(e.target.value) || 500 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base de conhecimento</Label>
                      <Textarea
                        value={config.knowledgeBase}
                        onChange={(e) => updateConfig({ knowledgeBase: e.target.value })}
                        placeholder="Cole aqui informações que a IA deve usar como referência..."
                        rows={4}
                      />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* === WHATSAPP === */}
            <AccordionItem value="whatsapp" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">WhatsApp</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label>Conexão / Número</Label>
                  <Select value={config.connectionId || "all"} onValueChange={(v) => updateConfig({ connectionId: v === "all" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Todas as conexões" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as conexões</SelectItem>
                      {connections?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.phone_number ? `(${c.phone_number})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione um número específico ou deixe para responder em todas.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* === TRANSFERÊNCIA === */}
            <AccordionItem value="transfer" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Transferência</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <Label>Habilitar transferência</Label>
                  <Switch
                    checked={config.transferEnabled}
                    onCheckedChange={(v) => updateConfig({ transferEnabled: v })}
                  />
                </div>
                {config.transferEnabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Transferir para</Label>
                      <Select value={config.transferType} onValueChange={(v) => updateConfig({ transferType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="queue">Fila</SelectItem>
                          <SelectItem value="agent">Atendente</SelectItem>
                          <SelectItem value="ai">Outro Agente de IA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {config.transferType === "queue" && (
                      <div className="space-y-2">
                        <Label>Fila de destino</Label>
                        <Select value={config.transferQueueId || "none"} onValueChange={(v) => updateConfig({ transferQueueId: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {queues?.map((q) => (
                              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {config.transferType === "agent" && (
                      <div className="space-y-2">
                        <Label>Atendente</Label>
                        <Select value={config.transferAgentId || "none"} onValueChange={(v) => updateConfig({ transferAgentId: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione o atendente" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {users?.map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {config.transferType === "ai" && (
                      <div className="space-y-2">
                        <Label>Agente de IA</Label>
                        <Select value={config.transferFlowId || "none"} onValueChange={(v) => updateConfig({ transferFlowId: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione o agente" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {otherFlows.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* === FOLLOW-UP === */}
            <AccordionItem value="followup" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Follow-up Automático</span>
                  {config.followUpEnabled && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {config.followUpStepConfigs.length} etapa{config.followUpStepConfigs.length > 1 ? "s" : ""} · {getTotalCycleTime(config.followUpStepConfigs)}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Habilitar follow-up</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Envia mensagens automáticas quando o contato não responde
                    </p>
                  </div>
                  <Switch
                    checked={config.followUpEnabled}
                    onCheckedChange={(v) => updateConfig({ followUpEnabled: v })}
                  />
                </div>
                {config.followUpEnabled && (
                  <>
                    {/* ── Etapas individuais ── */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          Etapas do Follow-up
                        </Label>
                        {config.followUpStepConfigs.length < 5 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newSteps = [...config.followUpStepConfigs, { interval: 1, unit: "hours" as const, message: "", mode: "ai" as const }];
                              updateConfig({
                                followUpStepConfigs: newSteps,
                                followUpSteps: newSteps.length,
                                followUpMessages: newSteps.map((s) => s.message),
                              });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Etapa
                          </Button>
                        )}
                      </div>

                      {config.followUpStepConfigs.map((step, idx) => (
                        <div key={idx} className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">Etapa {idx + 1}</span>
                            {config.followUpStepConfigs.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => {
                                  const newSteps = config.followUpStepConfigs.filter((_, i) => i !== idx);
                                  updateConfig({
                                    followUpStepConfigs: newSteps,
                                    followUpSteps: newSteps.length,
                                    followUpMessages: newSteps.map((s) => s.message),
                                  });
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Intervalo</Label>
                              <Input
                                type="number"
                                min={1}
                                value={step.interval}
                                onChange={(e) => {
                                  const newSteps = [...config.followUpStepConfigs];
                                  newSteps[idx] = { ...newSteps[idx], interval: Math.max(1, parseInt(e.target.value) || 1) };
                                  updateConfig({ followUpStepConfigs: newSteps });
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Unidade</Label>
                              <Select
                                value={step.unit}
                                onValueChange={(v) => {
                                  const newSteps = [...config.followUpStepConfigs];
                                  newSteps[idx] = { ...newSteps[idx], unit: v as "minutes" | "hours" | "days" };
                                  updateConfig({ followUpStepConfigs: newSteps });
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minutes">Minutos</SelectItem>
                                  <SelectItem value="hours">Horas</SelectItem>
                                  <SelectItem value="days">Dias</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tipo da mensagem</Label>
                            <Select
                              value={step.mode}
                              onValueChange={(v) => {
                                const newSteps = [...config.followUpStepConfigs];
                                newSteps[idx] = { ...newSteps[idx], mode: v as "ai" | "fixed" };
                                updateConfig({ followUpStepConfigs: newSteps });
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ai">🤖 IA gera automaticamente</SelectItem>
                                <SelectItem value="fixed">📝 Mensagem fixa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {step.mode === "fixed" && (
                            <div className="space-y-1">
                              <Label className="text-xs">Mensagem</Label>
                              <Textarea
                                value={step.message}
                                onChange={(e) => {
                                  const newSteps = [...config.followUpStepConfigs];
                                  newSteps[idx] = { ...newSteps[idx], message: e.target.value };
                                  updateConfig({
                                    followUpStepConfigs: newSteps,
                                    followUpMessages: newSteps.map((s) => s.message),
                                  });
                                }}
                                placeholder={`Mensagem da etapa ${idx + 1}...`}
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* ── Timeline preview ── */}
                    <div className="border border-border rounded-lg p-4 bg-muted/20">
                      <Label className="text-xs text-muted-foreground mb-3 block">Preview da timeline</Label>
                      <div className="flex items-center gap-1 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          Início
                        </div>
                        {config.followUpStepConfigs.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <div className="w-8 h-px bg-border" />
                            <div className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                              {step.interval}{step.unit === "minutes" ? "min" : step.unit === "hours" ? "h" : "d"} → {step.mode === "ai" ? "🤖" : "📝"} #{idx + 1}
                            </div>
                          </div>
                        ))}
                        <div className="w-8 h-px bg-border" />
                        <div className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                          {config.followUpFinalAction === "close" ? "🔒 Encerrar" : config.followUpFinalAction === "transfer" ? "↗️ Transferir" : "⏹ Fim"}
                        </div>
                      </div>
                    </div>

                    {/* ── Prompt IA ── */}
                    <div className="space-y-2">
                      <Label>Prompt para IA (usado nas etapas com modo IA)</Label>
                      <Textarea
                        value={config.followUpPrompt}
                        onChange={(e) => updateConfig({ followUpPrompt: e.target.value })}
                        placeholder="Ex: Gere uma mensagem amigável de acompanhamento..."
                        rows={3}
                      />
                    </div>

                    {/* ── Janela de horário ── */}
                    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Janela de envio
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Horário início</Label>
                          <Input
                            type="time"
                            value={config.followUpAllowedHoursStart}
                            onChange={(e) => updateConfig({ followUpAllowedHoursStart: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Horário fim</Label>
                          <Input
                            type="time"
                            value={config.followUpAllowedHoursEnd}
                            onChange={(e) => updateConfig({ followUpAllowedHoursEnd: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Dias permitidos</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: "mon", label: "Seg" },
                            { key: "tue", label: "Ter" },
                            { key: "wed", label: "Qua" },
                            { key: "thu", label: "Qui" },
                            { key: "fri", label: "Sex" },
                            { key: "sat", label: "Sáb" },
                            { key: "sun", label: "Dom" },
                          ].map((day) => (
                            <label key={day.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <Checkbox
                                checked={config.followUpAllowedDays.includes(day.key)}
                                onCheckedChange={(checked) => {
                                  const newDays = checked
                                    ? [...config.followUpAllowedDays, day.key]
                                    : config.followUpAllowedDays.filter((d) => d !== day.key);
                                  updateConfig({ followUpAllowedDays: newDays });
                                }}
                              />
                              {day.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── Modelo IA do Follow-up ── */}
                    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                      <Label className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-muted-foreground" />
                        IA do Follow-up
                      </Label>
                      <div className="space-y-2">
                        <Label className="text-xs">Modelo (separado do agente principal)</Label>
                        <Select value={config.followUpModel} onValueChange={(v) => updateConfig({ followUpModel: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="google/gemini-2.5-flash-lite">Gemini Flash Lite (mais rápido/barato)</SelectItem>
                            <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                            <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                            <SelectItem value="openai/gpt-5-nano">GPT-5 Nano</SelectItem>
                            <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <Thermometer className="w-3 h-3" />
                          Temperatura: {config.followUpTemperature}
                        </Label>
                        <Slider
                          value={[config.followUpTemperature]}
                          onValueChange={([v]) => updateConfig({ followUpTemperature: v })}
                          min={0}
                          max={1}
                          step={0.1}
                        />
                      </div>
                    </div>

                    {/* ── Condições de parada ── */}
                    <div className="space-y-3">
                      <Label>Condições de parada</Label>
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">✅ Contato respondeu (sempre ativo)</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={config.followUpStopOnHumanAssign}
                            onCheckedChange={(v) => updateConfig({ followUpStopOnHumanAssign: !!v })}
                          />
                          Parar se conversa for atribuída a um humano
                        </label>
                      </div>
                    </div>

                    {/* ── Ação final ── */}
                    <div className="space-y-2">
                      <Label>Ação após último follow-up</Label>
                      <Select value={config.followUpFinalAction} onValueChange={(v) => updateConfig({ followUpFinalAction: v as "none" | "close" | "transfer" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma ação</SelectItem>
                          <SelectItem value="close">Encerrar conversa</SelectItem>
                          <SelectItem value="transfer">Transferir para fila</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {config.followUpFinalAction === "transfer" && (
                      <div className="space-y-2">
                        <Label>Fila de destino</Label>
                        <Select value={config.followUpTransferQueueId || "none"} onValueChange={(v) => updateConfig({ followUpTransferQueueId: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {queues?.map((q) => (
                              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {config.followUpFinalAction === "close" && (
                      <div className="space-y-2">
                        <Label>Mensagem de encerramento do follow-up</Label>
                        <Textarea
                          value={config.followUpClosingMessage}
                          onChange={(e) => updateConfig({ followUpClosingMessage: e.target.value })}
                          placeholder="Ex: Como não obtivemos resposta, vou encerrar este atendimento. Fique à vontade para nos chamar novamente!"
                          rows={3}
                        />
                      </div>
                    )}
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="end" className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span className="font-medium">Encerramento</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label>Mensagem de encerramento</Label>
                  <Textarea
                    value={config.endMessage}
                    onChange={(e) => updateConfig({ endMessage: e.target.value })}
                    placeholder="Ex: Obrigado pelo contato! Até logo."
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Marcar conversa como resolvida</Label>
                  <Switch
                    checked={config.markResolved}
                    onCheckedChange={(v) => updateConfig({ markResolved: v })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  );
}
