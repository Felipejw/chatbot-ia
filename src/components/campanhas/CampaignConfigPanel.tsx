import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus, X, Upload, ClipboardPaste, Users, Tag, Image, FileVideo, FileText,
  AlertTriangle, Shield, ShieldCheck, Clock, Save, Loader2, Sparkles, Send, Play, BarChart3, Download, Shuffle, Timer, TrendingUp
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useCampaign, useUpdateCampaign, useAddContactsToCampaign,
  useMessageTemplates, useCreateMessageTemplate, Campaign,
} from "@/hooks/useCampaigns";
import { useContacts, useCreateContact } from "@/hooks/useContacts";
import { useTags } from "@/hooks/useTags";
import { useFlows } from "@/hooks/useFlows";
import { useAuth } from "@/contexts/AuthContext";
import { CampaignMetricsDashboard } from "./CampaignMetricsDashboard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const extractPhoneNumbers = (text: string): string[] => {
  const lines = text.split(/[\n,;]+/);
  const phones: string[] = [];
  for (const line of lines) {
    const cleaned = line.trim().replace(/[^\d+]/g, "");
    if (cleaned.length >= 8 && cleaned.length <= 15) phones.push(cleaned);
  }
  return [...new Set(phones)];
};

const parseCSVForPhones = (content: string) => {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim());
    return values;
  });
  return { headers, rows };
};

function calculateRiskLevel(settings: { minInterval: number; useVariations: boolean; contactCount: number }) {
  let score = 0;
  if (settings.minInterval < 30) score += 3;
  else if (settings.minInterval < 60) score += 1;
  if (!settings.useVariations) score += 1;
  if (settings.contactCount > 300) score += 2;
  else if (settings.contactCount > 100) score += 1;
  if (score >= 4) return "high" as const;
  if (score >= 2) return "medium" as const;
  return "low" as const;
}

interface CampaignConfigPanelProps {
  campaignId: string;
}

export function CampaignConfigPanel({ campaignId }: CampaignConfigPanelProps) {
  const { user } = useAuth();
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();
  const addContacts = useAddContactsToCampaign();
  const createContact = useCreateContact();
  const { data: contacts = [] } = useContacts();
  const { data: tags = [] } = useTags();
  const { data: templates = [] } = useMessageTemplates();
  const { data: flows = [] } = useFlows();
  const createTemplate = useCreateMessageTemplate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [useVariations, setUseVariations] = useState(false);
  const [variations, setVariations] = useState<string[]>(["", ""]);
  const [mediaType, setMediaType] = useState<"none" | "image" | "video" | "document">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [minInterval, setMinInterval] = useState(30);
  const [maxInterval, setMaxInterval] = useState(60);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [dailyLimit, setDailyLimit] = useState(200);
  const [allowedHoursStart, setAllowedHoursStart] = useState("08:00");
  const [allowedHoursEnd, setAllowedHoursEnd] = useState("20:00");
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState(5);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [connections, setConnections] = useState<Array<{id: string; name: string; status: string | null; phone_number: string | null}>>([]);
  const [warmupEnabled, setWarmupEnabled] = useState(false);
  const [warmupDailyIncrement, setWarmupDailyIncrement] = useState(50);
  const [longPauseEvery, setLongPauseEvery] = useState(0);
  const [longPauseMinutes, setLongPauseMinutes] = useState(10);
  const [shuffleContacts, setShuffleContacts] = useState(false);

  // Contacts
  const [contactSource, setContactSource] = useState<"list" | "paste" | "file">("list");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pastedNumbers, setPastedNumbers] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [phoneColumnIndex, setPhoneColumnIndex] = useState(-1);
  const [nameColumnIndex, setNameColumnIndex] = useState(-1);
  const [createContactsFromImport, setCreateContactsFromImport] = useState(true);

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Campaign contacts metrics
  const [campaignContactStats, setCampaignContactStats] = useState<{pending: number; sent: number; delivered: number; read: number; failed: number; replied: number; total: number}>({pending:0,sent:0,delivered:0,read:0,failed:0,replied:0,total:0});
  const [campaignContactsList, setCampaignContactsList] = useState<Array<{id:string; contact_name:string; contact_phone:string|null; status:string; sent_at:string|null; replied_at:string|null; last_error:string|null}>>([]);

  const activeFlows = flows.filter((f) => f.is_active);

  // Load connections
  useEffect(() => {
    supabase.from("connections").select("id, name, status, phone_number").then(({data}) => {
      if (data) setConnections(data);
    });
  }, []);

  // Load campaign data
  useEffect(() => {
    if (!campaign) return;
    setName(campaign.name);
    setDescription(campaign.description || "");
    setMessage(campaign.message || "");
    setSelectedFlowId(campaign.flow_id || "");
    setUseVariations(campaign.use_variations || false);
    setVariations(campaign.message_variations?.length ? campaign.message_variations : ["", ""]);
    setMediaType((campaign.media_type as any) || "none");
    setMediaUrl(campaign.media_url || "");
    setMinInterval(campaign.min_interval || 30);
    setMaxInterval(campaign.max_interval || 60);
    setScheduleEnabled(!!campaign.scheduled_at);
    setScheduledAt(campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : "");
    setDailyLimit(campaign.daily_limit ?? 200);
    setAllowedHoursStart(campaign.allowed_hours_start || "08:00");
    setAllowedHoursEnd(campaign.allowed_hours_end || "20:00");
    setMaxConsecutiveFailures(campaign.max_consecutive_failures ?? 5);
    setSelectedConnectionId(campaign.connection_id || "");
    setWarmupEnabled((campaign as any).warmup_enabled ?? false);
    setWarmupDailyIncrement((campaign as any).warmup_daily_increment ?? 50);
    setLongPauseEvery((campaign as any).long_pause_every ?? 0);
    setLongPauseMinutes((campaign as any).long_pause_minutes ?? 10);
    setShuffleContacts((campaign as any).shuffle_contacts ?? false);
    setHasChanges(false);
  }, [campaign]);

  // Load campaign contacts stats
  useEffect(() => {
    if (!campaignId) return;
    const loadStats = async () => {
      const { data } = await supabase
        .from("campaign_contacts")
        .select("id, status, sent_at, last_error, contact:contacts(name, phone)")
        .eq("campaign_id", campaignId);
      if (!data) return;
      const stats = {pending:0,sent:0,delivered:0,read:0,failed:0,total:data.length};
      const list: typeof campaignContactsList = [];
      for (const row of data) {
        const s = row.status || "pending";
        if (s === "pending") stats.pending++;
        else if (s === "sent" || s === "sending") stats.sent++;
        else if (s === "delivered") stats.delivered++;
        else if (s === "read") stats.read++;
        else if (s === "failed") stats.failed++;
        const c = row.contact as any;
        list.push({id: row.id, contact_name: c?.name || "—", contact_phone: c?.phone, status: s, sent_at: row.sent_at, last_error: row.last_error});
      }
      setCampaignContactStats(stats);
      setCampaignContactsList(list);
    };
    loadStats();
  }, [campaignId, campaign?.updated_at]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const filteredContacts = selectedTagIds.length > 0
    ? contacts.filter((c) => c.tags?.some((t: any) => selectedTagIds.includes(t.id)))
    : contacts;

  const contactCount = useMemo(() => {
    if (contactSource === "list") return selectedContactIds.length;
    if (contactSource === "paste") return parsedNumbers.length;
    if (contactSource === "file" && csvData) return csvData.rows.length;
    return 0;
  }, [contactSource, selectedContactIds, parsedNumbers, csvData]);

  const riskLevel = useMemo(
    () => calculateRiskLevel({ minInterval, useVariations, contactCount }),
    [minInterval, useVariations, contactCount]
  );

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setIsSaving(true);
    try {
      await updateCampaign.mutateAsync({
        id: campaignId,
        name: name.trim(),
        description: description.trim() || undefined,
        message: message.trim(),
        media_url: mediaUrl.trim() || undefined,
        media_type: mediaType !== "none" ? mediaType : undefined,
        scheduled_at: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        message_variations: useVariations ? variations.filter(Boolean) : undefined,
        use_variations: useVariations,
        min_interval: minInterval,
        max_interval: maxInterval,
      });

      // Save extra fields
      await supabase.from("campaigns").update({
        flow_id: selectedFlowId && selectedFlowId !== "none" ? selectedFlowId : null,
        daily_limit: dailyLimit,
        allowed_hours_start: allowedHoursStart,
        allowed_hours_end: allowedHoursEnd,
        max_consecutive_failures: maxConsecutiveFailures,
        connection_id: selectedConnectionId && selectedConnectionId !== "none" ? selectedConnectionId : null,
      }).eq("id", campaignId);

      setHasChanges(false);
      toast.success("Disparo salvo!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!message.trim()) { toast.error("Configure a mensagem antes de iniciar"); return; }
    await handleSave();
    await updateCampaign.mutateAsync({ id: campaignId, status: "active" });
  };

  const handleAddContacts = async () => {
    let contactIdsToAdd = [...selectedContactIds];

    if (contactSource === "paste" && parsedNumbers.length > 0 && createContactsFromImport) {
      for (const phone of parsedNumbers) {
        const existing = contacts.find((c) => c.phone?.replace(/\D/g, "") === phone.replace(/\D/g, ""));
        if (existing) { contactIdsToAdd.push(existing.id); continue; }
        try {
          const nc = await createContact.mutateAsync({ name: `Contato ${phone}`, phone });
          if (nc?.id) contactIdsToAdd.push(nc.id);
        } catch {}
      }
    } else if (contactSource === "file" && csvData && phoneColumnIndex >= 0) {
      for (const row of csvData.rows) {
        const phone = row[phoneColumnIndex]?.trim();
        if (!phone) continue;
        const existing = contacts.find((c) => c.phone?.replace(/\D/g, "") === phone.replace(/\D/g, ""));
        if (existing) { contactIdsToAdd.push(existing.id); continue; }
        if (createContactsFromImport) {
          try {
            const cName = nameColumnIndex >= 0 ? row[nameColumnIndex]?.trim() : undefined;
            const nc = await createContact.mutateAsync({ name: cName || `Contato ${phone}`, phone });
            if (nc?.id) contactIdsToAdd.push(nc.id);
          } catch {}
        }
      }
    }

    const unique = [...new Set(contactIdsToAdd)];
    if (unique.length > 0) {
      await addContacts.mutateAsync({ campaignId, contactIds: unique });
      setSelectedContactIds([]);
      setPastedNumbers("");
      setParsedNumbers([]);
      setCsvData(null);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setMessage(template.message);
      setMediaUrl(template.media_url || "");
      setMediaType((template.media_type as any) || "none");
      markChanged();
    }
  };

  const handleSaveTemplate = async () => {
    if (!name.trim() || !message.trim()) return;
    await createTemplate.mutateAsync({
      name: name.trim(),
      message: message.trim(),
      media_url: mediaUrl || undefined,
      media_type: mediaType !== "none" ? mediaType : undefined,
      created_by: user?.id,
    });
  };

  const insertVariable = (v: string) => { setMessage((p) => p + `{{${v}}}`); markChanged(); };
  const toggleContact = (id: string) => { setSelectedContactIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); };
  const toggleTag = (id: string) => { setSelectedTagIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); };
  const updateVariation = (i: number, t: string) => { const nv = [...variations]; nv[i] = t; setVariations(nv); markChanged(); };
  const addVariation = () => { if (variations.length < 5) { setVariations([...variations, ""]); markChanged(); } };
  const removeVariation = (i: number) => { if (variations.length > 1) { setVariations(variations.filter((_, idx) => idx !== i)); markChanged(); } };

  const handlePastedNumbersChange = (text: string) => {
    setPastedNumbers(text);
    setParsedNumbers(extractPhoneNumbers(text));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSVForPhones(e.target?.result as string);
      setCsvData(parsed);
      setPhoneColumnIndex(parsed.headers.findIndex((h) => /telefone|phone|celular|whatsapp/i.test(h)));
      setNameColumnIndex(parsed.headers.findIndex((h) => /nome|name/i.test(h)));
    };
    reader.readAsText(file);
  };

  const getRiskBadge = () => {
    const map = {
      low: { icon: ShieldCheck, label: "Baixo Risco", cls: "bg-success/10 text-success" },
      medium: { icon: Shield, label: "Risco Médio", cls: "bg-warning/10 text-warning" },
      high: { icon: AlertTriangle, label: "Alto Risco", cls: "bg-destructive/10 text-destructive" },
    };
    const r = map[riskLevel];
    return <Badge className={`${r.cls} gap-1`}><r.icon className="w-3 h-3" />{r.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Campanha não encontrada
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <p className="text-xs text-muted-foreground">
              {campaign.status === "draft" ? "Rascunho" : campaign.status === "active" ? "Ativa" : campaign.status === "paused" ? "Pausada" : "Concluída"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getRiskBadge()}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
          {campaign.status === "draft" && (
            <Button size="sm" onClick={handleStartCampaign} disabled={!message.trim()}>
              <Play className="w-4 h-4 mr-1" />
              Iniciar Disparo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="message" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 grid grid-cols-5 w-auto">
          <TabsTrigger value="message" className="text-xs">Mensagem</TabsTrigger>
          <TabsTrigger value="media" className="text-xs">Mídia</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs">Contatos</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Config</TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs">Métricas</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 pb-4">
          {/* Message Tab */}
          <TabsContent value="message" className="space-y-4 pt-4 mt-0">
            <div className="space-y-2">
              <Label>Nome do Disparo *</Label>
              <Input value={name} onChange={(e) => { setName(e.target.value); markChanged(); }} placeholder="Ex: Promoção de Verão" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => { setDescription(e.target.value); markChanged(); }} placeholder="Descreva o objetivo do disparo" />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>Carregar Template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleSaveTemplate} disabled={!name.trim() || !message.trim() || createTemplate.isPending}>
                {createTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-2">Salvar Template</span>
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Mensagem *</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable("nome")}>{"{{nome}}"}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable("telefone")}>{"{{telefone}}"}</Button>
                </div>
              </div>
              <Textarea rows={5} value={message} onChange={(e) => { setMessage(e.target.value); markChanged(); }} placeholder="Digite a mensagem do disparo. Use {{nome}} para personalizar." />
            </div>

            {/* Variations */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Variações da Mensagem (Anti-Ban)</Label>
                </div>
                <Switch checked={useVariations} onCheckedChange={(v) => { setUseVariations(v); markChanged(); }} />
              </div>
              {useVariations && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Adicione variações para reduzir o risco de banimento.</p>
                  {variations.map((v, i) => (
                    <div key={i} className="flex gap-2">
                      <Textarea placeholder={`Variação ${i + 1}...`} rows={2} value={v} onChange={(e) => updateVariation(i, e.target.value)} className="flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => removeVariation(i)} disabled={variations.length <= 1}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addVariation} disabled={variations.length >= 5}>
                    <Plus className="w-4 h-4 mr-1" />Adicionar Variação
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-4 pt-4 mt-0">
            <div className="space-y-2">
              <Label>Tipo de Mídia</Label>
              <RadioGroup value={mediaType} onValueChange={(v) => { setMediaType(v as any); markChanged(); }} className="grid grid-cols-4 gap-4">
                {[
                  { value: "none", icon: FileText, label: "Nenhuma" },
                  { value: "image", icon: Image, label: "Imagem" },
                  { value: "video", icon: FileVideo, label: "Vídeo" },
                  { value: "document", icon: FileText, label: "Documento" },
                ].map((opt) => (
                  <Label key={opt.value} htmlFor={`media-${opt.value}`} className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${mediaType === opt.value ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value={opt.value} id={`media-${opt.value}`} className="sr-only" />
                    <opt.icon className="w-6 h-6" />
                    <span className="text-sm">{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {mediaType !== "none" && (
              <div className="space-y-2">
                <Label>URL da Mídia</Label>
                <Input placeholder="https://exemplo.com/arquivo.jpg" value={mediaUrl} onChange={(e) => { setMediaUrl(e.target.value); markChanged(); }} />
                <p className="text-xs text-muted-foreground">Cole a URL pública do arquivo de mídia</p>
              </div>
            )}
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4 pt-4 mt-0">
            <div className="space-y-4">
              <Label>Origem dos Contatos</Label>
              <RadioGroup value={contactSource} onValueChange={(v) => setContactSource(v as any)} className="grid grid-cols-3 gap-4">
                {[
                  { value: "list", icon: Users, label: "Lista de Contatos" },
                  { value: "paste", icon: ClipboardPaste, label: "Colar Números" },
                  { value: "file", icon: Upload, label: "Importar Arquivo" },
                ].map((opt) => (
                  <Label key={opt.value} htmlFor={`source-${opt.value}`} className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${contactSource === opt.value ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value={opt.value} id={`source-${opt.value}`} className="sr-only" />
                    <opt.icon className="w-6 h-6" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {contactSource === "list" && (
              <>
                <div className="space-y-2">
                  <Label>Filtrar por Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag.id} variant={selectedTagIds.includes(tag.id) ? "default" : "outline"} className="cursor-pointer" style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}} onClick={() => toggleTag(tag.id)}>
                        <Tag className="w-3 h-3 mr-1" />{tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Selecionar Contatos ({selectedContactIds.length})</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedContactIds(filteredContacts.map((c) => c.id))}>Selecionar todos</Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedContactIds([])}>Limpar</Button>
                  </div>
                </div>
                <ScrollArea className="h-[250px] border rounded-lg p-2">
                  {filteredContacts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">Nenhum contato encontrado</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <div key={contact.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => toggleContact(contact.id)}>
                          <Checkbox checked={selectedContactIds.includes(contact.id)} onCheckedChange={() => toggleContact(contact.id)} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">{contact.phone || contact.email || "Sem contato"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}

            {contactSource === "paste" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cole os números de telefone</Label>
                  <Textarea placeholder="Cole números separados por linha, vírgula ou ponto-e-vírgula..." rows={5} value={pastedNumbers} onChange={(e) => handlePastedNumbersChange(e.target.value)} />
                </div>
                {parsedNumbers.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">{parsedNumbers.length} números detectados</p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
                      {parsedNumbers.slice(0, 20).map((phone, i) => <Badge key={i} variant="secondary" className="text-xs">{phone}</Badge>)}
                      {parsedNumbers.length > 20 && <Badge variant="outline" className="text-xs">+{parsedNumbers.length - 20} mais</Badge>}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="create-contacts-paste" checked={createContactsFromImport} onCheckedChange={(v) => setCreateContactsFromImport(!!v)} />
                  <Label htmlFor="create-contacts-paste" className="text-sm">Criar contatos automaticamente para números novos</Label>
                </div>
              </div>
            )}

            {contactSource === "file" && (
              <div className="space-y-4">
                {!csvData ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Selecione um arquivo CSV ou TXT</p>
                    <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                    <Button onClick={() => fileInputRef.current?.click()}>Selecionar Arquivo</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{csvData.rows.length} linhas encontradas</p>
                      <Button variant="ghost" size="sm" onClick={() => setCsvData(null)}><X className="w-4 h-4 mr-1" />Remover</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Coluna do Telefone *</Label>
                        <Select value={String(phoneColumnIndex)} onValueChange={(v) => setPhoneColumnIndex(parseInt(v))}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">Selecione...</SelectItem>
                            {csvData.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Coluna do Nome (opcional)</Label>
                        <Select value={String(nameColumnIndex)} onValueChange={(v) => setNameColumnIndex(parseInt(v))}>
                          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">Nenhuma</SelectItem>
                            {csvData.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="create-contacts-file" checked={createContactsFromImport} onCheckedChange={(v) => setCreateContactsFromImport(!!v)} />
                      <Label htmlFor="create-contacts-file" className="text-sm">Criar contatos automaticamente</Label>
                    </div>
                  </>
                )}
              </div>
            )}

            {contactCount > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">{contactCount} contatos selecionados</span>
                <Button size="sm" onClick={handleAddContacts} disabled={addContacts.isPending}>
                  {addContacts.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />}
                  Adicionar à Campanha
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 pt-4 mt-0">
            {/* Connection Selection */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                <Label className="font-medium">Conexão para Envio</Label>
              </div>
              <p className="text-sm text-muted-foreground">Selecione qual WhatsApp conectado usar para este disparo.</p>
              <Select value={selectedConnectionId} onValueChange={(v) => { setSelectedConnectionId(v); markChanged(); }}>
                <SelectTrigger><SelectValue placeholder="Usar conexão padrão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Usar conexão padrão</SelectItem>
                  {connections.filter(c => c.status === "connected").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.phone_number ? `(${c.phone_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Agent */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <Label className="font-medium">Agente de IA</Label>
              </div>
              <p className="text-sm text-muted-foreground">Selecione um agente para processar respostas dos contatos.</p>
              <Select value={selectedFlowId} onValueChange={(v) => { setSelectedFlowId(v); markChanged(); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um agente (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum agente</SelectItem>
                  {activeFlows.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Anti-ban Security */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <Label className="font-medium">Proteção Anti-Ban</Label>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Intervalo mínimo: {minInterval}s</Label>
                  <Slider value={[minInterval]} onValueChange={([v]) => { setMinInterval(v); if (v > maxInterval) setMaxInterval(v); markChanged(); }} min={10} max={180} step={5} />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo máximo: {maxInterval}s</Label>
                  <Slider value={[maxInterval]} onValueChange={([v]) => { setMaxInterval(v); if (v < minInterval) setMinInterval(v); markChanged(); }} min={10} max={300} step={5} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Limite diário de envios: {dailyLimit.toLocaleString()}</Label>
                  <Slider value={[dailyLimit]} onValueChange={([v]) => { setDailyLimit(v); markChanged(); }} min={10} max={30000} step={100} />
                  <p className="text-xs text-muted-foreground">Pausa automaticamente ao atingir este limite por dia. Recomendado: 200-300.</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Horário permitido para envio</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">24 horas</Label>
                      <Switch
                        checked={allowedHoursStart === "00:00" && allowedHoursEnd === "23:59"}
                        onCheckedChange={(v) => {
                          if (v) {
                            setAllowedHoursStart("00:00");
                            setAllowedHoursEnd("23:59");
                          } else {
                            setAllowedHoursStart("08:00");
                            setAllowedHoursEnd("20:00");
                          }
                          markChanged();
                        }}
                      />
                    </div>
                  </div>
                  {!(allowedHoursStart === "00:00" && allowedHoursEnd === "23:59") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Início</Label>
                        <Input type="time" value={allowedHoursStart} onChange={(e) => { setAllowedHoursStart(e.target.value); markChanged(); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fim</Label>
                        <Input type="time" value={allowedHoursEnd} onChange={(e) => { setAllowedHoursEnd(e.target.value); markChanged(); }} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {allowedHoursStart === "00:00" && allowedHoursEnd === "23:59"
                      ? "Envio permitido 24 horas por dia."
                      : "Mensagens só serão enviadas dentro deste horário."}
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Pausa por falhas consecutivas: {maxConsecutiveFailures}</Label>
                  <Slider value={[maxConsecutiveFailures]} onValueChange={([v]) => { setMaxConsecutiveFailures(v); markChanged(); }} min={1} max={20} step={1} />
                  <p className="text-xs text-muted-foreground">Pausa a campanha automaticamente após {maxConsecutiveFailures} falhas seguidas.</p>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />Dicas para evitar banimento</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use intervalos de 60-180 segundos entre mensagens</li>
                  <li>• Ative variações de mensagem para humanizar</li>
                  <li>• Limite envios a 200-300 contatos por dia</li>
                  <li>• Envie apenas no horário comercial (08:00 - 20:00)</li>
                  <li>• Use {"{{nome}}"} para personalizar</li>
                  <li>• Use uma conexão dedicada para disparos em massa</li>
                </ul>
              </div>
            </div>

            {/* Schedule */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Agendar para depois</Label>
                </div>
                <Switch checked={scheduleEnabled} onCheckedChange={(v) => { setScheduleEnabled(v); markChanged(); }} />
              </div>
              {scheduleEnabled && (
                <div className="space-y-2">
                  <Label>Data e hora de início</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => { setScheduledAt(e.target.value); markChanged(); }} min={new Date().toISOString().slice(0, 16)} />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-6 pt-4 mt-0">
            {/* Campaign-specific stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Pendentes", value: campaignContactStats.pending, color: "text-muted-foreground" },
                { label: "Enviadas", value: campaignContactStats.sent, color: "text-primary" },
                { label: "Entregues", value: campaignContactStats.delivered, color: "text-blue-500" },
                { label: "Lidas", value: campaignContactStats.read, color: "text-success" },
                { label: "Falhas", value: campaignContactStats.failed, color: "text-destructive" },
                { label: "Total", value: campaignContactStats.total, color: "text-foreground" },
              ].map((stat) => (
                <div key={stat.label} className="border rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {campaignContactStats.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{Math.round(((campaignContactStats.sent + campaignContactStats.delivered + campaignContactStats.read) / campaignContactStats.total) * 100)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((campaignContactStats.sent + campaignContactStats.delivered + campaignContactStats.read) / campaignContactStats.total) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Contact list with status */}
            <div className="space-y-2">
              <Label className="font-medium">Contatos ({campaignContactsList.length})</Label>
              {campaignContactsList.length === 0 ? (
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum contato adicionado ainda</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="divide-y">
                    {campaignContactsList.map((cc) => (
                      <div key={cc.id} className="flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-medium">{cc.contact_name}</p>
                          <p className="text-xs text-muted-foreground">{cc.contact_phone || "—"}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={cc.status === "sent" || cc.status === "delivered" || cc.status === "read" ? "default" : cc.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                            {cc.status === "pending" ? "Pendente" : cc.status === "sending" ? "Enviando" : cc.status === "sent" ? "Enviada" : cc.status === "delivered" ? "Entregue" : cc.status === "read" ? "Lida" : "Falha"}
                          </Badge>
                          {cc.last_error && <p className="text-xs text-destructive mt-1 max-w-[200px] truncate">{cc.last_error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
