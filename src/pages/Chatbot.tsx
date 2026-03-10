import { useState, useCallback } from "react";
import { FlowSidebar } from "@/components/chatbot/FlowSidebar";
import { AgentConfigPanel } from "@/components/chatbot/AgentConfigPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Brain } from "lucide-react";

export default function Chatbot() {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSelectFlow = useCallback((id: string | null) => {
    setSelectedFlowId(id);
    if (id) setSidebarCollapsed(true);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)] -m-6">
        <FlowSidebar
          selectedFlowId={selectedFlowId}
          onSelectFlow={handleSelectFlow}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        {selectedFlowId ? (
          <AgentConfigPanel flowId={selectedFlowId} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Selecione um agente</p>
              <p className="text-sm">ou crie um novo para configurar</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
