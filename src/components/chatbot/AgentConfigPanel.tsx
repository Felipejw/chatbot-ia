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
import { Save, Loader2, Settings, Zap, Brain, MessageCircle, ArrowRightLeft, XCircle, RotateCcw } from "lucide-react";
import { useFlow, useFlows, type ChatbotFlow } from "@/hooks/useFlows";
import { useQueues } from "@/hooks/useQueues";
import { useUsers } from "@/hooks/useUsers";
import { useWhatsAppConnections } from "@/hooks/useWhatsAppConnections";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  endMessage: "",
  markResolved: true,
};

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
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
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
                    <div className="space-y-2">
                      <Label>Número de etapas (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={config.followUpSteps}
                        onChange={(e) => {
                          const steps = Math.max(1, Math.min(5, parseInt(e.target.value) || 3));
                          const msgs = [...config.followUpMessages];
                          while (msgs.length < steps) msgs.push("");
                          updateConfig({ followUpSteps: steps, followUpMessages: msgs.slice(0, steps) });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Intervalo entre etapas (minutos)</Label>
                      <Input
                        type="number"
                        min={5}
                        value={config.followUpIntervalMinutes}
                        onChange={(e) => updateConfig({ followUpIntervalMinutes: Math.max(5, parseInt(e.target.value) || 60) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {config.followUpIntervalMinutes >= 60
                          ? `${Math.floor(config.followUpIntervalMinutes / 60)}h${config.followUpIntervalMinutes % 60 > 0 ? ` ${config.followUpIntervalMinutes % 60}min` : ""}`
                          : `${config.followUpIntervalMinutes} minutos`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Modo da mensagem</Label>
                      <Select value={config.followUpMode} onValueChange={(v) => updateConfig({ followUpMode: v as "ai" | "fixed" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ai">IA gera automaticamente</SelectItem>
                          <SelectItem value="fixed">Mensagens fixas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {config.followUpMode === "ai" ? (
                      <div className="space-y-2">
                        <Label>Prompt para a IA</Label>
                        <Textarea
                          value={config.followUpPrompt}
                          onChange={(e) => updateConfig({ followUpPrompt: e.target.value })}
                          placeholder="Ex: Gere uma mensagem amigável de acompanhamento..."
                          rows={3}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Label>Mensagens por etapa</Label>
                        {Array.from({ length: config.followUpSteps }).map((_, idx) => (
                          <div key={idx} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Etapa {idx + 1}</Label>
                            <Textarea
                              value={config.followUpMessages[idx] || ""}
                              onChange={(e) => {
                                const msgs = [...config.followUpMessages];
                                msgs[idx] = e.target.value;
                                updateConfig({ followUpMessages: msgs });
                              }}
                              placeholder={`Mensagem da etapa ${idx + 1}...`}
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                    )}
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
