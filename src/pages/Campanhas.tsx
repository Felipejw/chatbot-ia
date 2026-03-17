import { useState, useCallback } from "react";
import { CampaignSidebar } from "@/components/campanhas/CampaignSidebar";
import { CampaignConfigPanel } from "@/components/campanhas/CampaignConfigPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Send } from "lucide-react";

export default function Campanhas() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSelectCampaign = useCallback((id: string | null) => {
    setSelectedCampaignId(id);
    if (id) setSidebarCollapsed(true);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)] -m-6">
        <CampaignSidebar
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={handleSelectCampaign}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        {selectedCampaignId ? (
          <CampaignConfigPanel campaignId={selectedCampaignId} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center text-muted-foreground">
              <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Selecione um disparo</p>
              <p className="text-sm">ou crie um novo para configurar</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
