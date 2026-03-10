import { AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ValidationBadgeProps {
  message: string;
}

export function ValidationBadge({ message }: ValidationBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="absolute -top-2 -right-2 bg-amber-500 rounded-full p-1 shadow-md animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 text-white" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-amber-500 text-white border-amber-500">
        <p className="text-xs font-medium">{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Validation helper functions
export function validateTriggerNode(data: Record<string, unknown>): string | null {
  const triggerType = data.triggerType as string;
  if (!triggerType) return "Selecione o tipo de gatilho";
  if ((triggerType === "keyword" || triggerType === "phrase") && !data.triggerValue) {
    return triggerType === "keyword" ? "Digite a palavra-chave" : "Digite a frase";
  }
  return null;
}


export function validateWhatsAppNode(data: Record<string, unknown>): string | null {
  if (!data.connectionId) return "Selecione o número de WhatsApp";
  return null;
}

export function validateDelayNode(data: Record<string, unknown>): string | null {
  if (!data.delay || (data.delay as number) <= 0) return "Configure o tempo de espera";
  return null;
}

export function validateTransferNode(data: Record<string, unknown>): string | null {
  const transferType = (data.transferType as string) || "queue";
  if (transferType === "queue" && !data.queueId) return "Selecione o setor";
  if (transferType === "agent" && !data.agentId) return "Selecione o atendente";
  if (transferType === "whatsapp" && !data.connectionId) return "Selecione o número";
  if (transferType === "ai" && !data.flowId) return "Selecione o agente de IA";
  return null;
}

export function validateAINode(data: Record<string, unknown>): string | null {
  if (data.isEnabled !== false && !data.systemPrompt) {
    return "Configure o prompt do sistema";
  }
  return null;
}
