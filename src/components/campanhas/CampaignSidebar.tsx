import { useState } from "react";
import { Plus, Search, Trash2, Play, Pause, ChevronLeft, ChevronRight, Send, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCampaigns, useCreateCampaign, useDeleteCampaign, useUpdateCampaign, Campaign } from "@/hooks/useCampaigns";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", className: "bg-success/10 text-success" },
  paused: { label: "Pausada", className: "bg-warning/10 text-warning" },
  completed: { label: "Concluída", className: "bg-primary/10 text-primary" },
};

interface CampaignSidebarProps {
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CampaignSidebar({
  selectedCampaignId,
  onSelectCampaign,
  collapsed = false,
  onToggleCollapse,
}: CampaignSidebarProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { user } = useAuth();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const updateCampaign = useUpdateCampaign();

  const filteredCampaigns = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "all" || c.status === statusFilter)
  );

  const handleCreate = async () => {
    const count = campaigns.length + 1;
    const result = await createCampaign.mutateAsync({
      name: `Disparo ${count}`,
      message: "",
      created_by: user?.id,
    });
    if (result?.id) onSelectCampaign(result.id);
  };

  const handleDelete = async (id: string) => {
    if (selectedCampaignId === id) onSelectCampaign(null);
    await deleteCampaign.mutateAsync(id);
  };

  const handleDuplicate = async (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await createCampaign.mutateAsync({
      name: `${campaign.name} (cópia)`,
      message: campaign.message,
      message_variations: campaign.message_variations ?? undefined,
      use_variations: campaign.use_variations ?? undefined,
      use_buttons: campaign.use_buttons ?? undefined,
      buttons: campaign.buttons as Array<{ id: string; text: string }> | undefined,
      min_interval: campaign.min_interval ?? undefined,
      max_interval: campaign.max_interval ?? undefined,
      template_id: campaign.template_id ?? undefined,
      flow_id: campaign.flow_id ?? undefined,
      created_by: user?.id,
    });
    if (result?.id) onSelectCampaign(result.id);
  };

  const handleToggleStatus = async (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await updateCampaign.mutateAsync({ id: campaign.id, status: newStatus });
  };

  const statusFilters = [
    { value: "all", label: "Todas" },
    { value: "draft", label: "Rascunho" },
    { value: "active", label: "Ativas" },
    { value: "paused", label: "Pausadas" },
    { value: "completed", label: "Concluídas" },
  ];

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border bg-card flex flex-col h-full items-center py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="mb-4">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expandir disparos</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={handleCreate} disabled={createCampaign.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Novo disparo</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="font-semibold text-sm">Disparos</h3>
          </div>
          <Button size="sm" className="gap-1" onClick={handleCreate} disabled={createCampaign.isPending}>
            <Plus className="w-4 h-4" />
            Novo
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar disparo..."
            className="pl-9 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {statusFilters.map((f) => (
            <Badge
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-1.5 py-0"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Badge>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {search ? "Nenhum disparo encontrado" : "Nenhum disparo criado"}
            </div>
          ) : (
            filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() => onSelectCampaign(campaign.id)}
                className={cn(
                  "p-3 rounded-lg cursor-pointer transition-colors group",
                  selectedCampaignId === campaign.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate flex-1">{campaign.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(campaign.status === "active" || campaign.status === "paused" || campaign.status === "draft") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleToggleStatus(campaign, e)}
                      >
                        {campaign.status === "active" ? (
                          <Pause className="w-3.5 h-3.5 text-warning" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-success" />
                        )}
                      </Button>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => handleDuplicate(campaign, e)}
                          disabled={createCampaign.isPending}
                        >
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicar</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir disparo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O disparo "{campaign.name}" será excluído permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(campaign.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] px-1.5 py-0", statusConfig[campaign.status]?.className)}>
                    {statusConfig[campaign.status]?.label}
                  </Badge>
                  {(campaign.sent_count ?? 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Send className="w-3 h-3" />
                      {campaign.sent_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
