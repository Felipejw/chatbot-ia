import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/components/BrandingProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Eager-loaded routes (critical path)
import Index from "./pages/Index";
import Login from "./pages/Login";

// Lazy-loaded routes
const AcessoNegado = lazy(() => import("./pages/AcessoNegado"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Atendimento = lazy(() => import("./pages/Atendimento"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Tags = lazy(() => import("./pages/Tags"));
const Agendamentos = lazy(() => import("./pages/Agendamentos"));
const Campanhas = lazy(() => import("./pages/Campanhas"));
const Chatbot = lazy(() => import("./pages/Chatbot"));
const FilasChatbot = lazy(() => import("./pages/FilasChatbot"));
const Integracoes = lazy(() => import("./pages/Integracoes"));
const Conexoes = lazy(() => import("./pages/Conexoes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));

const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <BrandingProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/recuperar-senha" element={<RecuperarSenha />} />
              <Route path="/acesso-negado" element={<AcessoNegado />} />
              
              {/* App Routes with Layout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="/atendimento" element={<ProtectedRoute module="atendimento"><Atendimento /></ProtectedRoute>} />
                <Route path="/kanban" element={<ProtectedRoute module="kanban"><Kanban /></ProtectedRoute>} />
                <Route path="/agendamentos" element={<ProtectedRoute module="agendamentos"><Agendamentos /></ProtectedRoute>} />
                <Route path="/tags" element={<ProtectedRoute module="tags"><Tags /></ProtectedRoute>} />
                <Route path="/campanhas" element={<ProtectedRoute module="campanhas"><Campanhas /></ProtectedRoute>} />
                <Route path="/chatbot" element={<ProtectedRoute module="chatbot"><Chatbot /></ProtectedRoute>} />
                <Route path="/filas-chatbot" element={<ProtectedRoute module="setores"><FilasChatbot /></ProtectedRoute>} />
                <Route path="/integracoes" element={<ProtectedRoute module="integracoes"><Integracoes /></ProtectedRoute>} />
                <Route path="/conexoes" element={<ProtectedRoute module="conexoes"><Conexoes /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </TooltipProvider>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
