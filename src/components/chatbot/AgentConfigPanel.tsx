import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, Settings, Zap, Brain, MessageCircle, ArrowRightLeft, XCircle, RotateCcw, Plus, Trash2, Clock, Calendar, Thermometer, ShoppingCart, Headphones, CalendarCheck, Target, UserCheck, Pencil, Sparkles, Expand, ChevronDown, Crosshair, Scale, Lightbulb, AlignLeft, AlignCenter, AlignJustify } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFlow, useFlows, type ChatbotFlow } from "@/hooks/useFlows";
import { useQueues } from "@/hooks/useQueues";
import { useUsers } from "@/hooks/useUsers";
import { useWhatsAppConnections } from "@/hooks/useWhatsAppConnections";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FollowUpStep {
  interval: number;
  unit: "minutes" | "hours" | "days";
  message: string;
  mode: "ai" | "fixed";
  mediaUrl?: string;
  mediaType?: "none" | "image" | "audio" | "video";
}

interface AgentConfig {
  triggerType: string;
  triggerValue: string;
  aiEnabled: boolean;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  knowledgeBase: string;
  connectionId: string;
  transferEnabled: boolean;
  transferType: string;
  transferQueueId: string;
  transferAgentId: string;
  transferFlowId: string;
  followUpEnabled: boolean;
  followUpSteps: number;
  followUpIntervalMinutes: number;
  followUpMode: "ai" | "fixed";
  followUpMessages: string[];
  followUpPrompt: string;
  followUpFinalAction: "none" | "close" | "transfer";
  followUpTransferQueueId: string;
  followUpStepConfigs: FollowUpStep[];
  followUpAllowedHoursStart: string;
  followUpAllowedHoursEnd: string;
  followUpAllowedDays: string[];
  followUpModel: string;
  followUpTemperature: number;
  followUpClosingMessage: string;
  followUpStopOnHumanAssign: boolean;
  endMessage: string;
  markResolved: boolean;
  agentProfile?: string;
  responseDelay: number;
  responseDelayMode: "fixed" | "random";
  responseDelayMax: number;
}

// Agent profile definitions
interface AgentProfile {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  recommended?: boolean;
  model: string;
  temperature: number;
  systemPrompt: string;
}

const AGENT_PROFILES: AgentProfile[] = [
  {
    key: "vendedor",
    label: "Vendedor (X1)",
    description: "Especialista em vendas consultivas, converte leads e tira dúvidas",
    icon: ShoppingCart,
    color: "bg-warning/15 text-warning border-warning/30",
    recommended: true,
    model: "google/gemini-2.5-flash",
    temperature: 0.8,
    systemPrompt: `Você é um especialista em vendas consultivas via WhatsApp (X1). Seu objetivo é converter leads em clientes.

Diretrizes:
- Seja amigável, empático e persuasivo, sem ser invasivo
- Faça perguntas abertas para entender a necessidade do cliente
- Destaque benefícios e diferenciais do produto/serviço
- Trate objeções de preço com naturalidade, mostrando valor
- Crie senso de urgência quando apropriado (ofertas limitadas, últimas unidades)
- Use linguagem acessível e informal (mas profissional)
- Sempre ofereça um próximo passo claro (enviar catálogo, agendar demo, fechar pedido)
- Nunca invente informações sobre produtos — se não souber, diga que vai verificar
- Responda rápido e de forma concisa, como numa conversa real de WhatsApp`,
  },
  {
    key: "suporte",
    label: "Suporte",
    description: "Atendente de suporte técnico/SAC, resolve problemas com empatia",
    icon: Headphones,
    color: "bg-info/15 text-info border-info/30",
    model: "google/gemini-2.5-flash",
    temperature: 0.5,
    systemPrompt: `Você é um atendente de suporte técnico/SAC via WhatsApp. Seu objetivo é resolver problemas e tirar dúvidas de forma rápida e empática.

Diretrizes:
- Seja paciente, empático e objetivo
- Primeiro entenda completamente o problema antes de sugerir soluções
- Dê instruções passo a passo, claras e numeradas quando necessário
- Se não conseguir resolver, escale para um humano sem fazer o cliente repetir informações
- Nunca culpe o cliente pelo problema
- Confirme se o problema foi resolvido antes de encerrar
- Use linguagem simples, evite jargões técnicos desnecessários
- Peça desculpas por inconvenientes de forma genuína`,
  },
  {
    key: "agendamento",
    label: "Agendamento",
    description: "Agenda reuniões, consultas e confirma horários automaticamente",
    icon: CalendarCheck,
    color: "bg-accent/15 text-accent border-accent/30",
    model: "google/gemini-2.5-flash-lite",
    temperature: 0.5,
    systemPrompt: `Você é um assistente especializado em agendamento via WhatsApp. Seu objetivo é facilitar marcação de reuniões, consultas e compromissos.

Diretrizes:
- Ofereça horários disponíveis de forma clara e organizada
- Confirme data, horário e local/link com o cliente
- Envie lembretes amigáveis antes do compromisso
- Trate reagendamentos e cancelamentos com flexibilidade
- Colete informações necessárias (nome, telefone, motivo) de forma natural
- Sugira alternativas quando o horário desejado não estiver disponível
- Seja breve e direto — agendamentos devem ser rápidos`,
  },
  {
    key: "qualificacao",
    label: "Qualificação",
    description: "Qualifica leads com perguntas estratégicas antes de transferir",
    icon: Target,
    color: "bg-destructive/15 text-destructive border-destructive/30",
    model: "google/gemini-2.5-flash",
    temperature: 0.6,
    systemPrompt: `Você é um especialista em qualificação de leads via WhatsApp. Seu objetivo é coletar informações estratégicas para avaliar o potencial do lead antes de transferi-lo para vendas.

Diretrizes:
- Faça perguntas naturais e conversacionais (não pareça um formulário)
- Colete informações BANT: Budget (orçamento), Authority (decisor), Need (necessidade), Timeline (prazo)
- Identifique o nível de interesse e urgência do lead
- Classifique o lead como quente, morno ou frio
- Quando qualificado, faça uma transição suave para o vendedor com resumo
- Não tente vender — seu papel é qualificar e transferir
- Seja amigável e demonstre interesse genuíno no problema do lead`,
  },
  {
    key: "recepcionista",
    label: "Recepcionista",
    description: "Boas-vindas e direcionamento para o setor correto",
    icon: UserCheck,
    color: "bg-primary/15 text-primary border-primary/30",
    model: "google/gemini-2.5-flash-lite",
    temperature: 0.7,
    systemPrompt: `Você é uma recepcionista virtual via WhatsApp. Seu objetivo é dar boas-vindas, entender a necessidade do contato e direcioná-lo para o setor correto.

Diretrizes:
- Cumprimente de forma calorosa e profissional
- Identifique rapidamente o motivo do contato
- Direcione para o departamento correto (vendas, suporte, financeiro, etc.)
- Se não souber para onde direcionar, faça perguntas para entender melhor
- Informe sobre horários de funcionamento quando relevante
- Colete nome e informações básicas do contato
- Seja ágil — ninguém gosta de esperar na recepção`,
  },
  {
    key: "custom",
    label: "Personalizado",
    description: "Configure tudo manualmente do seu jeito",
    icon: Pencil,
    color: "bg-muted text-muted-foreground border-border",
    model: "",
    temperature: -1,
    systemPrompt: "",
  },
];

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
  responseDelay: 0,
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

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${
        active
          ? "bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.5)] animate-pulse-soft"
          : "bg-muted-foreground/20"
      }`}
    />
  );
}

// Section header component for each tab content
function SectionHeader({ icon: Icon, title, description, color }: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Separator className="mt-4 mb-6" />
    </div>
  );
}

// Card wrapper for grouped fields
function FieldCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <CardContent className="p-5 space-y-5">
        {children}
      </CardContent>
    </Card>
  );
}

// Enhanced label with description
function FieldLabel({ children, description, icon: Icon }: {
  children: React.ReactNode;
  description?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        {children}
      </Label>
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  );
}

// Tab item config with colors and descriptions
const tabConfig = {
  general: { color: "bg-primary/10 text-primary", desc: "Nome e status" },
  trigger: { color: "bg-warning/10 text-warning", desc: "Quando ativar" },
  ai: { color: "bg-[hsl(270_70%_55%/0.1)] text-[hsl(270_70%_55%)]", desc: "Modelo e prompt" },
  whatsapp: { color: "bg-accent/10 text-accent", desc: "Conexão" },
  transfer: { color: "bg-info/10 text-info", desc: "Para onde enviar" },
  followup: { color: "bg-[hsl(200_80%_50%/0.1)] text-[hsl(200_80%_50%)]", desc: "Reengajamento" },
  end: { color: "bg-destructive/10 text-destructive", desc: "Finalização" },
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
  const isMobile = useIsMobile();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  const tabItems = [
    { value: "general", label: "Geral", icon: Settings, active: true },
    { value: "trigger", label: "Gatilho", icon: Zap, active: config.triggerType === "new_conversation" || config.triggerType === "all" || !!config.triggerValue },
    { value: "ai", label: "IA", icon: Brain, active: config.aiEnabled },
    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, active: !!config.connectionId },
    { value: "transfer", label: "Transferência", icon: ArrowRightLeft, active: config.transferEnabled },
    { value: "followup", label: "Follow-up", icon: RotateCcw, active: config.followUpEnabled },
    { value: "end", label: "Encerramento", icon: XCircle, active: !!config.endMessage },
  ];

  return (
    <div className="flex-1 flex flex-col bg-muted/20">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{name || "Configuração do Agente"}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={`text-[10px] px-2 py-0 h-5 ${isActive ? "bg-accent text-accent-foreground" : ""}`}
              >
                {isActive ? "Ativo" : "Inativo"}
              </Badge>
              {hasChanges && (
                <span className="text-[10px] text-warning font-medium">● Alterações não salvas</span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2 shadow-sm">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {hasChanges ? "Salvar" : "Salvo"}
        </Button>
      </div>

      <Tabs defaultValue="general" className={`flex-1 flex ${isMobile ? "flex-col" : "flex-row"} overflow-hidden`}>
        {/* Tab navigation */}
        <TabsList className={`${
          isMobile
            ? "flex h-auto w-full overflow-x-auto border-b border-border rounded-none bg-background/80 backdrop-blur-sm p-2 gap-1 justify-start shrink-0"
            : "flex flex-col h-full w-56 shrink-0 border-r border-border rounded-none bg-background/60 backdrop-blur-sm p-3 gap-1 justify-start items-stretch"
        }`}>
          {tabItems.map((tab) => {
            const cfg = tabConfig[tab.value as keyof typeof tabConfig];
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={`group ${
                  isMobile
                    ? "flex items-center gap-2 px-3 py-2.5 text-xs whitespace-nowrap rounded-lg"
                    : "flex items-center gap-3 px-3 py-3 text-sm justify-start rounded-xl w-full"
                } data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/80 data-[state=inactive]:text-muted-foreground hover:bg-card/50 transition-all duration-200`}
              >
                <div className={`${isMobile ? "w-7 h-7" : "w-8 h-8"} rounded-lg flex items-center justify-center shrink-0 ${cfg.color} transition-colors`}>
                  <tab.icon className={`${isMobile ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
                </div>
                <div className={`${isMobile ? "" : "flex-1 text-left"}`}>
                  <span className="font-medium block leading-tight">{tab.label}</span>
                  {!isMobile && (
                    <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5 group-data-[state=active]:text-muted-foreground/80">
                      {cfg.desc}
                    </span>
                  )}
                </div>
                <StatusDot active={tab.active} />
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab contents */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-2xl">
              {/* === GERAL === */}
              <TabsContent value="general" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={Settings}
                  title="Geral"
                  description="Informações básicas e status do agente"
                  color={tabConfig.general.color}
                />
                <FieldCard>
                  <div className="space-y-2">
                    <FieldLabel description="Identifique este agente com um nome claro e descritivo">
                      Nome do agente
                    </FieldLabel>
                    <Input
                      value={name}
                      onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
                      placeholder="Ex: Atendimento Vendas"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel description="Descreva brevemente o objetivo deste agente">
                      Descrição
                    </FieldLabel>
                    <Textarea
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
                      placeholder="Descreva o objetivo deste agente..."
                      rows={3}
                    />
                  </div>
                </FieldCard>
                <FieldCard>
                  <div className="flex items-center justify-between">
                    <FieldLabel description="Quando ativo, o agente responde automaticamente às mensagens">
                      Agente ativo
                    </FieldLabel>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className={`text-xs ${isActive ? "bg-accent text-accent-foreground" : ""}`}
                      >
                        {isActive ? "Ativo" : "Inativo"}
                      </Badge>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => { setIsActive(v); setHasChanges(true); }}
                      />
                    </div>
                  </div>
                </FieldCard>
              </TabsContent>

              {/* === GATILHO === */}
              <TabsContent value="trigger" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={Zap}
                  title="Gatilho"
                  description="Defina quando este agente deve ser ativado"
                  color={tabConfig.trigger.color}
                />
                <FieldCard>
                  <div className="space-y-2">
                    <FieldLabel icon={Zap} description="Escolha como o agente identifica que deve responder">
                      Tipo de gatilho
                    </FieldLabel>
                    <Select value={config.triggerType} onValueChange={(v) => updateConfig({ triggerType: v })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
                      <FieldLabel description={config.triggerType === "keyword" ? "Separe múltiplas palavras com vírgula" : "A frase completa que deve ser detectada"}>
                        Valor do gatilho
                      </FieldLabel>
                      <Input
                        value={config.triggerValue}
                        onChange={(e) => updateConfig({ triggerValue: e.target.value })}
                        placeholder={config.triggerType === "keyword" ? "Ex: vendas, preço, comprar" : "Ex: Quero falar com vendas"}
                        className="h-11"
                      />
                    </div>
                  )}
                </FieldCard>
              </TabsContent>

              {/* === IA === */}
              <TabsContent value="ai" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={Brain}
                  title="Inteligência Artificial"
                  description="Configure o modelo, personalidade e comportamento da IA"
                  color={tabConfig.ai.color}
                />
                <FieldCard>
                  <div className="flex items-center justify-between">
                    <FieldLabel description="Habilite para que o agente use IA para gerar respostas">
                      IA habilitada
                    </FieldLabel>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={config.aiEnabled ? "default" : "secondary"}
                        className={`text-xs ${config.aiEnabled ? "bg-[hsl(270_70%_55%)] text-white" : ""}`}
                      >
                        {config.aiEnabled ? "Ligada" : "Desligada"}
                      </Badge>
                      <Switch
                        checked={config.aiEnabled}
                        onCheckedChange={(v) => updateConfig({ aiEnabled: v })}
                      />
                    </div>
                  </div>
                </FieldCard>

                {config.aiEnabled && (
                  <>
                    {/* Agent Profile Selector */}
                    <FieldCard>
                      <FieldLabel icon={Sparkles} description="Escolha um perfil para pré-configurar prompt, modelo e temperatura automaticamente (opcional)">
                        Perfil do Agente
                      </FieldLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                        {AGENT_PROFILES.map((profile) => {
                          const isSelected = (config.agentProfile || "custom") === profile.key;
                          const ProfileIcon = profile.icon;
                          return (
                            <button
                              key={profile.key}
                              type="button"
                              onClick={() => {
                                if (profile.key === "custom") {
                                  updateConfig({ agentProfile: "custom" });
                                } else {
                                  updateConfig({
                                    agentProfile: profile.key,
                                    model: profile.model,
                                    temperature: profile.temperature,
                                    systemPrompt: profile.systemPrompt,
                                  });
                                }
                              }}
                              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md ${
                                isSelected
                                  ? `${profile.color} border-current shadow-sm`
                                  : "border-border/50 bg-card hover:border-border"
                              }`}
                            >
                              {profile.recommended && (
                                <Badge className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0 bg-warning text-warning-foreground shadow-sm">
                                  Popular
                                </Badge>
                              )}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isSelected ? profile.color : "bg-muted"
                              } transition-colors`}>
                                <ProfileIcon className="w-5 h-5" />
                              </div>
                              <div className="text-center">
                                <span className="text-xs font-semibold block leading-tight">{profile.label}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5 block line-clamp-2">
                                  {profile.description}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </FieldCard>

                    <FieldCard>
                      <div className="space-y-2">
                        <FieldLabel icon={Brain} description="Escolha o modelo de IA que melhor se adapta ao seu uso">
                          Modelo
                        </FieldLabel>
                        <Select value={config.model} onValueChange={(v) => updateConfig({ model: v })}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem disabled value="__gemini_header" className="text-xs font-semibold text-muted-foreground">── Google Gemini (Gratuito) ──</SelectItem>
                            <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</SelectItem>
                            <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                            <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Rápido)</SelectItem>
                            <SelectItem disabled value="__openai_header" className="text-xs font-semibold text-muted-foreground">── OpenAI ChatGPT (Pago) ──</SelectItem>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (Recomendado, econômico)</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o (Mais capaz)</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Rápido)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </FieldCard>

                    <FieldCard>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <FieldLabel description="Instruções que definem a personalidade e comportamento da IA">
                            Prompt do sistema
                          </FieldLabel>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                <Expand className="w-3.5 h-3.5" />
                                Expandir
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle>Prompt do sistema</DialogTitle>
                              </DialogHeader>
                              <Textarea
                                value={config.systemPrompt}
                                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                                placeholder="Descreva como a IA deve se comportar, o tom de voz, regras específicas..."
                                className="flex-1 font-mono text-sm resize-none"
                              />
                              <div className="text-xs text-muted-foreground text-right">
                                {config.systemPrompt.length} caracteres
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <Textarea
                          value={config.systemPrompt}
                          onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                          placeholder="Descreva como a IA deve se comportar, o tom de voz, regras específicas..."
                          rows={12}
                          className="font-mono text-sm"
                        />
                        <div className="text-xs text-muted-foreground text-right">
                          {config.systemPrompt.length} caracteres
                        </div>
                      </div>
                    </FieldCard>

                    <FieldCard>
                      <div className="space-y-3">
                        <FieldLabel icon={Sparkles} description="Define o quão criativas e variadas serão as respostas da IA">
                          Criatividade das respostas
                        </FieldLabel>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Preciso", value: 0.3, desc: "Objetivo e consistente", icon: Crosshair, color: "bg-info/15 text-info border-info/30" },
                            { label: "Equilibrado", value: 0.6, desc: "Natural e equilibrado", icon: Scale, color: "bg-accent/15 text-accent border-accent/30" },
                            { label: "Criativo", value: 0.9, desc: "Humano e variado", icon: Lightbulb, color: "bg-warning/15 text-warning border-warning/30" },
                          ].map((preset) => {
                            const isSelected = Math.abs(config.temperature - preset.value) < 0.05;
                            const PresetIcon = preset.icon;
                            return (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => updateConfig({ temperature: preset.value })}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                                  isSelected
                                    ? `${preset.color} border-current shadow-sm`
                                    : "border-border/50 bg-card hover:border-border"
                                }`}
                              >
                                <PresetIcon className="w-5 h-5" />
                                <span className="text-xs font-semibold">{preset.label}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">{preset.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                              <ChevronDown className="w-3.5 h-3.5" />
                              Ajuste fino ({config.temperature})
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <Slider
                              value={[config.temperature]}
                              onValueChange={([v]) => updateConfig({ temperature: v })}
                              min={0}
                              max={1}
                              step={0.1}
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>0 — Preciso</span>
                              <span>1 — Criativo</span>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </FieldCard>

                    <FieldCard>
                      <div className="space-y-3">
                        <FieldLabel description="Define o tamanho máximo que cada resposta da IA pode ter">
                          Tamanho máximo das respostas
                        </FieldLabel>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: "Curta", value: 250, desc: "1-2 frases diretas", icon: AlignLeft },
                            { label: "Média", value: 500, desc: "3-5 frases completas", icon: AlignCenter },
                            { label: "Longa", value: 1000, desc: "Detalhada e explicativa", icon: AlignJustify },
                            { label: "Personalizado", value: -1, desc: "Defina manualmente", icon: Pencil },
                          ].map((preset) => {
                            const isSelected = preset.value === -1
                              ? ![250, 500, 1000].includes(config.maxTokens)
                              : config.maxTokens === preset.value;
                            const PresetIcon = preset.icon;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  if (preset.value !== -1) updateConfig({ maxTokens: preset.value });
                                }}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                                  isSelected
                                    ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                    : "border-border/50 bg-card hover:border-border"
                                }`}
                              >
                                <PresetIcon className="w-4 h-4" />
                                <span className="text-xs font-semibold">{preset.label}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">{preset.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                        {![250, 500, 1000].includes(config.maxTokens) && (
                          <Input
                            type="number"
                            value={config.maxTokens}
                            onChange={(e) => updateConfig({ maxTokens: parseInt(e.target.value) || 500 })}
                            className="h-11"
                            placeholder="Ex: 750"
                          />
                        )}
                      </div>
                    </FieldCard>

                    <FieldCard>
                      <div className="space-y-2">
                        <FieldLabel description="Informações de referência que a IA deve considerar ao responder">
                          Base de conhecimento
                        </FieldLabel>
                        <Textarea
                          value={config.knowledgeBase}
                          onChange={(e) => updateConfig({ knowledgeBase: e.target.value })}
                          placeholder="Cole aqui informações que a IA deve usar como referência..."
                          rows={4}
                          className="font-mono text-sm"
                        />
                      </div>
                    </FieldCard>

                    <FieldCard>
                      <div className="space-y-3">
                        <FieldLabel icon={Clock} description="Tempo que a IA aguarda após a última mensagem recebida antes de responder. Útil para esperar o contato terminar de digitar.">
                          Tempo de espera antes de responder
                        </FieldLabel>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: "Imediato", value: 0 },
                            { label: "3 seg", value: 3 },
                            { label: "5 seg", value: 5 },
                            { label: "10 seg", value: 10 },
                          ].map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => updateConfig({ responseDelay: preset.value })}
                              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                                config.responseDelay === preset.value
                                  ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                  : "border-border/50 bg-card hover:border-border"
                              }`}
                            >
                              <Clock className="w-4 h-4" />
                              <span className="text-xs font-semibold">{preset.label}</span>
                            </button>
                          ))}
                        </div>
                        {![0, 3, 5, 10].includes(config.responseDelay) && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={config.responseDelay}
                              onChange={(e) => updateConfig({ responseDelay: parseInt(e.target.value) || 0 })}
                              className="h-11 w-32"
                              min={0}
                              max={120}
                            />
                            <span className="text-sm text-muted-foreground">segundos</span>
                          </div>
                        )}
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                              <ChevronDown className="w-3.5 h-3.5" />
                              Valor personalizado ({config.responseDelay}s)
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={config.responseDelay}
                                onChange={(e) => updateConfig({ responseDelay: Math.max(0, Math.min(120, parseInt(e.target.value) || 0)) })}
                                className="h-11 w-32"
                                min={0}
                                max={120}
                              />
                              <span className="text-sm text-muted-foreground">segundos (0-120)</span>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </FieldCard>
                  </>
                )}

                {!config.aiEnabled && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground opacity-60">
                    <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Ative a IA para configurar modelo, prompt e parâmetros</p>
                  </div>
                )}
              </TabsContent>

              {/* === WHATSAPP === */}
              <TabsContent value="whatsapp" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={MessageCircle}
                  title="WhatsApp"
                  description="Selecione a conexão que este agente deve utilizar"
                  color={tabConfig.whatsapp.color}
                />
                <FieldCard>
                  <div className="space-y-2">
                    <FieldLabel icon={MessageCircle} description="Selecione um número específico ou deixe para responder em todas as conexões">
                      Conexão / Número
                    </FieldLabel>
                    <Select value={config.connectionId || "all"} onValueChange={(v) => updateConfig({ connectionId: v === "all" ? "" : v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Todas as conexões" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as conexões</SelectItem>
                        {connections?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.phone_number ? `(${c.phone_number})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FieldCard>
              </TabsContent>

              {/* === TRANSFERÊNCIA === */}
              <TabsContent value="transfer" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={ArrowRightLeft}
                  title="Transferência"
                  description="Configure quando e para onde transferir o atendimento"
                  color={tabConfig.transfer.color}
                />
                <FieldCard>
                  <div className="flex items-center justify-between">
                    <FieldLabel description="Permite que o agente transfira a conversa automaticamente">
                      Habilitar transferência
                    </FieldLabel>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={config.transferEnabled ? "default" : "secondary"}
                        className={`text-xs ${config.transferEnabled ? "bg-info text-info-foreground" : ""}`}
                      >
                        {config.transferEnabled ? "Ativa" : "Inativa"}
                      </Badge>
                      <Switch
                        checked={config.transferEnabled}
                        onCheckedChange={(v) => updateConfig({ transferEnabled: v })}
                      />
                    </div>
                  </div>
                </FieldCard>

                {config.transferEnabled && (
                  <FieldCard>
                    <div className="space-y-2">
                      <FieldLabel description="Escolha o destino da transferência">
                        Transferir para
                      </FieldLabel>
                      <Select value={config.transferType} onValueChange={(v) => updateConfig({ transferType: v })}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="queue">Fila</SelectItem>
                          <SelectItem value="agent">Atendente</SelectItem>
                          <SelectItem value="ai">Outro Agente de IA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {config.transferType === "queue" && (
                      <div className="space-y-2">
                        <FieldLabel>Fila de destino</FieldLabel>
                        <Select value={config.transferQueueId || "none"} onValueChange={(v) => updateConfig({ transferQueueId: v === "none" ? "" : v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
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
                        <FieldLabel>Atendente</FieldLabel>
                        <Select value={config.transferAgentId || "none"} onValueChange={(v) => updateConfig({ transferAgentId: v === "none" ? "" : v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o atendente" /></SelectTrigger>
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
                        <FieldLabel>Agente de IA</FieldLabel>
                        <Select value={config.transferFlowId || "none"} onValueChange={(v) => updateConfig({ transferFlowId: v === "none" ? "" : v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o agente" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {otherFlows.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </FieldCard>
                )}

                {!config.transferEnabled && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground opacity-60">
                    <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Ative para configurar transferência automática</p>
                  </div>
                )}
              </TabsContent>

              {/* === FOLLOW-UP === */}
              <TabsContent value="followup" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={RotateCcw}
                  title="Follow-up"
                  description="Mensagens automáticas de acompanhamento quando o contato não responde"
                  color={tabConfig.followup.color}
                />
                <FieldCard>
                  <div className="flex items-center justify-between">
                    <FieldLabel description="Envia mensagens automáticas quando o contato não responde">
                      Habilitar follow-up
                    </FieldLabel>
                    <div className="flex items-center gap-3">
                      {config.followUpEnabled && (
                        <Badge className="bg-[hsl(200_80%_50%)] text-white text-[10px] px-2">
                          Ciclo: {getTotalCycleTime(config.followUpStepConfigs)}
                        </Badge>
                      )}
                      <Switch
                        checked={config.followUpEnabled}
                        onCheckedChange={(v) => updateConfig({ followUpEnabled: v })}
                      />
                    </div>
                  </div>
                </FieldCard>

                {config.followUpEnabled && (
                  <>
                    {/* Steps */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <FieldLabel icon={Clock}>Etapas do Follow-up</FieldLabel>
                        {config.followUpStepConfigs.length < 5 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              const newSteps = [...config.followUpStepConfigs, { interval: 1, unit: "hours" as const, message: "", mode: "ai" as const }];
                              updateConfig({
                                followUpStepConfigs: newSteps,
                                followUpSteps: newSteps.length,
                                followUpMessages: newSteps.map((s) => s.message),
                              });
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Adicionar
                          </Button>
                        )}
                      </div>

                      {config.followUpStepConfigs.map((step, idx) => (
                        <Card
                          key={idx}
                          className="border-l-4 hover:shadow-md transition-shadow duration-200"
                          style={{ borderLeftColor: `hsl(${200 + idx * 20}, 70%, 55%)` }}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{ backgroundColor: `hsl(${200 + idx * 20}, 70%, 55%)` }}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-semibold text-foreground">Etapa {idx + 1}</span>
                              </div>
                              {config.followUpStepConfigs.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
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
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Intervalo</Label>
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
                                <Label className="text-xs text-muted-foreground">Unidade</Label>
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
                              <Label className="text-xs text-muted-foreground">Tipo da mensagem</Label>
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
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Mensagem</Label>
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
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Mídia (opcional)</Label>
                                  <Select
                                    value={step.mediaType || "none"}
                                    onValueChange={(v) => {
                                      const newSteps = [...config.followUpStepConfigs];
                                      newSteps[idx] = { ...newSteps[idx], mediaType: v as any, mediaUrl: v === "none" ? "" : newSteps[idx].mediaUrl };
                                      updateConfig({ followUpStepConfigs: newSteps });
                                    }}
                                  >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sem mídia</SelectItem>
                                      <SelectItem value="image">🖼️ Imagem</SelectItem>
                                      <SelectItem value="audio">🎵 Áudio</SelectItem>
                                      <SelectItem value="video">🎬 Vídeo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {step.mediaType && step.mediaType !== "none" && (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">URL da mídia</Label>
                                    <Input
                                      value={step.mediaUrl || ""}
                                      onChange={(e) => {
                                        const newSteps = [...config.followUpStepConfigs];
                                        newSteps[idx] = { ...newSteps[idx], mediaUrl: e.target.value };
                                        updateConfig({ followUpStepConfigs: newSteps });
                                      }}
                                      placeholder="https://exemplo.com/arquivo.jpg"
                                    />
                                    {step.mediaUrl && step.mediaType === "image" && (
                                      <img src={step.mediaUrl} alt="Preview" className="mt-2 rounded-lg max-h-32 object-cover border border-border" />
                                    )}
                                    {step.mediaUrl && step.mediaType === "video" && (
                                      <video src={step.mediaUrl} className="mt-2 rounded-lg max-h-32 border border-border" controls />
                                    )}
                                    {step.mediaUrl && step.mediaType === "audio" && (
                                      <audio src={step.mediaUrl} className="mt-2 w-full" controls />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Timeline preview */}
                    <FieldCard>
                      <FieldLabel icon={Clock}>Preview da timeline</FieldLabel>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                          <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.4)]" />
                          Início
                        </div>
                        {config.followUpStepConfigs.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div className="w-10 h-0.5 bg-border rounded-full" />
                            <div
                              className="text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap border"
                              style={{
                                backgroundColor: `hsl(${200 + idx * 20}, 70%, 55%, 0.1)`,
                                borderColor: `hsl(${200 + idx * 20}, 70%, 55%, 0.3)`,
                                color: `hsl(${200 + idx * 20}, 70%, 45%)`,
                              }}
                            >
                              {step.interval}{step.unit === "minutes" ? "min" : step.unit === "hours" ? "h" : "d"} → {step.mode === "ai" ? "🤖" : "📝"} #{idx + 1}
                            </div>
                          </div>
                        ))}
                        <div className="w-10 h-0.5 bg-border rounded-full" />
                        <div className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium border border-border">
                          {config.followUpFinalAction === "close" ? "🔒 Encerrar" : config.followUpFinalAction === "transfer" ? "↗️ Transferir" : "⏹ Fim"}
                        </div>
                      </div>
                    </FieldCard>

                    {/* AI Prompt */}
                    <FieldCard>
                      <div className="space-y-2">
                        <FieldLabel icon={Brain} description="Usado nas etapas com modo IA para gerar mensagens">
                          Prompt para IA
                        </FieldLabel>
                        <Textarea
                          value={config.followUpPrompt}
                          onChange={(e) => updateConfig({ followUpPrompt: e.target.value })}
                          placeholder="Ex: Gere uma mensagem amigável de acompanhamento..."
                          rows={3}
                        />
                      </div>
                    </FieldCard>

                    {/* Schedule window */}
                    <FieldCard>
                      <FieldLabel icon={Calendar} description="Defina o horário e dias em que o follow-up pode enviar mensagens">
                        Janela de envio
                      </FieldLabel>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Início</Label>
                          <Input
                            type="time"
                            value={config.followUpAllowedHoursStart}
                            onChange={(e) => updateConfig({ followUpAllowedHoursStart: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fim</Label>
                          <Input
                            type="time"
                            value={config.followUpAllowedHoursEnd}
                            onChange={(e) => updateConfig({ followUpAllowedHoursEnd: e.target.value })}
                            className="h-11"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        <Label className="text-xs text-muted-foreground">Dias permitidos</Label>
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
                            <label key={day.key} className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-foreground transition-colors">
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
                    </FieldCard>

                    {/* Follow-up AI model */}
                    <FieldCard>
                      <FieldLabel icon={Brain} description="Modelo de IA independente, usado apenas no follow-up">
                        IA do Follow-up
                      </FieldLabel>
                      <div className="space-y-2 mt-2">
                        <Label className="text-xs text-muted-foreground">Modelo</Label>
                        <Select value={config.followUpModel} onValueChange={(v) => updateConfig({ followUpModel: v })}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="google/gemini-2.5-flash-lite">Gemini Flash Lite (mais rápido)</SelectItem>
                            <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                            <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                            <SelectItem value="openai/gpt-5-nano">GPT-5 Nano</SelectItem>
                            <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3 mt-3">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
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
                    </FieldCard>

                    {/* Stop conditions */}
                    <FieldCard>
                      <FieldLabel description="Condições que interrompem o envio de follow-ups">
                        Condições de parada
                      </FieldLabel>
                      <div className="space-y-3 mt-2 text-sm">
                        <p className="text-muted-foreground flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs">✓</span>
                          Contato respondeu (sempre ativo)
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                          <Checkbox
                            checked={config.followUpStopOnHumanAssign}
                            onCheckedChange={(v) => updateConfig({ followUpStopOnHumanAssign: !!v })}
                          />
                          Parar se conversa for atribuída a um humano
                        </label>
                      </div>
                    </FieldCard>

                    {/* Final action */}
                    <FieldCard>
                      <div className="space-y-2">
                        <FieldLabel description="O que acontece quando todos os follow-ups são enviados sem resposta">
                          Ação após último follow-up
                        </FieldLabel>
                        <Select value={config.followUpFinalAction} onValueChange={(v) => updateConfig({ followUpFinalAction: v as "none" | "close" | "transfer" })}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma ação</SelectItem>
                            <SelectItem value="close">Encerrar conversa</SelectItem>
                            <SelectItem value="transfer">Transferir para fila</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {config.followUpFinalAction === "transfer" && (
                        <div className="space-y-2">
                          <FieldLabel>Fila de destino</FieldLabel>
                          <Select value={config.followUpTransferQueueId || "none"} onValueChange={(v) => updateConfig({ followUpTransferQueueId: v === "none" ? "" : v })}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
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
                          <FieldLabel>Mensagem de encerramento</FieldLabel>
                          <Textarea
                            value={config.followUpClosingMessage}
                            onChange={(e) => updateConfig({ followUpClosingMessage: e.target.value })}
                            placeholder="Ex: Como não obtivemos resposta, vou encerrar este atendimento..."
                            rows={3}
                          />
                        </div>
                      )}
                    </FieldCard>
                  </>
                )}

                {!config.followUpEnabled && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground opacity-60">
                    <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Ative para configurar mensagens automáticas de acompanhamento</p>
                  </div>
                )}
              </TabsContent>

              {/* === ENCERRAMENTO === */}
              <TabsContent value="end" className="mt-0 space-y-6 animate-fade-in">
                <SectionHeader
                  icon={XCircle}
                  title="Encerramento"
                  description="Configure a finalização automática do atendimento"
                  color={tabConfig.end.color}
                />
                <FieldCard>
                  <div className="space-y-2">
                    <FieldLabel description="Mensagem enviada ao contato quando o atendimento é encerrado">
                      Mensagem de encerramento
                    </FieldLabel>
                    <Textarea
                      value={config.endMessage}
                      onChange={(e) => updateConfig({ endMessage: e.target.value })}
                      placeholder="Ex: Obrigado pelo contato! Até logo."
                      rows={3}
                    />
                  </div>
                </FieldCard>
                <FieldCard>
                  <div className="flex items-center justify-between">
                    <FieldLabel description="Muda o status da conversa para 'resolvida' automaticamente">
                      Marcar conversa como resolvida
                    </FieldLabel>
                    <Switch
                      checked={config.markResolved}
                      onCheckedChange={(v) => updateConfig({ markResolved: v })}
                    />
                  </div>
                </FieldCard>
              </TabsContent>
            </div>
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  );
}
