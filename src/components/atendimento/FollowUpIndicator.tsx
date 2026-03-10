import { useState, useEffect } from "react";
import { Clock, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFollowUps } from "@/hooks/useFollowUps";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowUpIndicatorProps {
  conversationId: string;
}

export function FollowUpIndicator({ conversationId }: FollowUpIndicatorProps) {
  const { pendingFollowUps, nextFollowUp, cancelFollowUp, cancelAllPending } =
    useFollowUps(conversationId);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!nextFollowUp) return;

    const update = () => {
      const diff = new Date(nextFollowUp.scheduled_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Enviando...");
        return;
      }
      setTimeLeft(
        formatDistanceToNow(new Date(nextFollowUp.scheduled_at), {
          locale: ptBR,
          addSuffix: false,
        })
      );
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [nextFollowUp]);

  if (pendingFollowUps.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="gap-1 text-xs border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
            >
              <RotateCcw className="w-3 h-3 animate-spin" style={{ animationDuration: "3s" }} />
              Follow-up {nextFollowUp?.step}/{nextFollowUp?.max_steps} em {timeLeft}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                cancelAllPending.mutate(conversationId);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {pendingFollowUps.length} follow-up(s) agendado(s)
            </p>
            {pendingFollowUps.map((fu) => (
              <div key={fu.id} className="flex items-center gap-2 text-xs">
                <Clock className="w-3 h-3" />
                <span>
                  Etapa {fu.step}/{fu.max_steps} —{" "}
                  {formatDistanceToNow(new Date(fu.scheduled_at), {
                    locale: ptBR,
                    addSuffix: true,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-destructive"
                  onClick={() => cancelFollowUp.mutate(fu.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
