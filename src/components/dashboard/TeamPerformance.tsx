import { useTeamPerformance } from "@/hooks/useDashboardStats";
import { SkeletonTeamPerformance } from "@/components/ui/SkeletonCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";

export function TeamPerformance() {
  const { data: team, isLoading } = useTeamPerformance();

  if (isLoading) return <SkeletonTeamPerformance />;

  const sorted = [...(team || [])].sort((a, b) => (b.resolved + b.active) - (a.resolved + a.active));
  const maxTotal = sorted.length > 0 ? sorted[0].resolved + sorted[0].active : 1;

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-lg">Performance da Equipe</h3>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum atendente encontrado
        </p>
      ) : (
        <div className="space-y-5">
          {sorted.slice(0, 5).map((member) => {
            const total = member.resolved + member.active;
            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            const initials = member.name
              ?.split(" ")
              .map((w: string) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?";

            return (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate max-w-[120px]">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="text-success font-medium">{member.resolved} resolvidas</span>
                    <span>{member.active} ativas</span>
                  </div>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
