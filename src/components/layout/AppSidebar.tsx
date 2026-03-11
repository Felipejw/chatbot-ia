import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, Tags, Settings,
  Send, Bot, Plug, QrCode, ChevronsLeft, ChevronsRight, Building2, LogOut,
  Sun, Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { type ModuleKey } from "@/hooks/usePermissions";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { toast } from "@/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface NavItem { title: string; href: string; icon: React.ElementType; module?: ModuleKey; }

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { title: "WhatsApp", href: "/atendimento", icon: MessageSquare, module: "atendimento" },
  { title: "Tags", href: "/tags", icon: Tags, module: "tags" },
  { title: "Agentes de IA", href: "/chatbot", icon: Bot, module: "chatbot" },
  { title: "Disparo em Massa", href: "/campanhas", icon: Send, module: "campanhas" },
  { title: "Setores", href: "/filas-chatbot", icon: Building2, module: "setores" },
  { title: "Integrações", href: "/integracoes", icon: Plug, module: "integracoes" },
  { title: "Conexões", href: "/conexoes", icon: QrCode, module: "conexoes" },
];

interface AppSidebarProps { onNavigate?: () => void; }

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isAdmin, signOut, profile } = useAuth();
  const { getSetting } = useSystemSettings();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const platformName = getSetting("platform_name") || "WhatzApp IA";
  const platformLogo = getSetting("platform_logo");

  const { data: unreadCount } = useQuery({
    queryKey: ["sidebar-unread-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gt("unread_count", 0)
        .in("status", ["new", "in_progress"]);
      return count || 0;
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const isActive = (href: string) => location.pathname === href;

  const visibleItems = isAdmin
    ? navItems
    : navItems.filter(item => !item.module || hasPermission(item.module, 'view'));

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-300 border-r border-sidebar-border",
        isCollapsed ? "w-16" : "w-64"
      )}
      style={{
        background: 'linear-gradient(180deg, hsl(var(--sidebar-background)) 0%, hsl(218 55% 7%) 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            {platformLogo ? (
              <img src={platformLogo} alt={platformName} className="w-8 h-8 object-contain rounded-lg" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                <MessageSquare className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
            )}
            <span className="font-bold text-lg text-sidebar-foreground">{platformName}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  "sidebar-link",
                  isActive(item.href) && "sidebar-link-active",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{item.title}</span>}
                {item.href === "/atendimento" && unreadCount && unreadCount > 0 ? (
                  <span className={cn(
                    "bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center",
                    isCollapsed ? "absolute -top-1 -right-1 w-4 h-4" : "ml-auto w-5 h-5"
                  )}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border">
        {!isCollapsed && profile && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-accent/30">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary-foreground">
                {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-sidebar-foreground">{profile.name}</p>
              <p className="text-xs text-sidebar-muted truncate">{profile.email}</p>
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        )}
        {isCollapsed && profile && (
          <div className="relative flex justify-center px-3 py-3">
            <Avatar className="h-8 w-8 ring-2 ring-accent/30">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary-foreground">
                {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-sidebar text-sidebar-muted hover:text-sidebar-foreground transition-colors"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            </button>
          </div>
        )}
        <div className="p-3 space-y-1">
          <NavLink
            to="/configuracoes"
            onClick={onNavigate}
            className={cn("sidebar-link", isActive("/configuracoes") && "sidebar-link-active", isCollapsed && "justify-center px-2")}
          >
            <Settings className="w-5 h-5" />
            {!isCollapsed && <span>Configurações</span>}
          </NavLink>
          <button
            onClick={async () => {
              try {
                await signOut();
                onNavigate?.();
                navigate("/login");
              } catch {
                toast.error("Erro ao sair. Tente novamente.");
              }
            }}
            className={cn(
              "sidebar-link w-full text-destructive/80 hover:text-destructive",
              isCollapsed && "justify-center px-2"
            )}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
