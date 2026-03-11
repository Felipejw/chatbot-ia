import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }).max(100),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const { getSetting } = useSystemSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const platformName = getSetting("platform_name") || "WhatzApp IA";
  const platformLogo = getSetting("platform_logo");
  const currentYear = new Date().getFullYear();

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        if (error.message.includes("Invalid login")) { toast.error("E-mail ou senha incorretos"); } else { toast.error(error.message); }
      } else { toast.success("Login realizado com sucesso!"); }
    } catch (error: any) { toast.error("Erro ao fazer login: " + error.message); } finally { setIsLoading(false); }
  };

  if (authLoading) {
    return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Navy gradient with decorative elements */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(218 55% 10%) 0%, hsl(217 100% 25%) 50%, hsl(218 55% 10%) 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: 'hsl(145 69% 49%)' }} />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full opacity-8" style={{ background: 'hsl(217 100% 58%)' }} />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full opacity-5" style={{ background: 'hsl(145 69% 49%)' }} />

        <div className="flex items-center gap-2.5 relative z-10">
          {platformLogo ? (
            <img src={platformLogo} alt={platformName} className="w-10 h-10 rounded-xl object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <span className="font-bold text-xl text-white">{platformName}</span>
        </div>

        <div className="space-y-6 relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Gerencie todas as suas<br />conversas em um<br />
            <span className="text-accent">só lugar</span>
          </h1>
          <p className="text-lg text-white/60 max-w-md">
            Plataforma completa de atendimento, campanhas e automação com inteligência artificial.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-sm text-white/80">Multi-atendente</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-white/80">IA Integrada</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-white/30 relative z-10">© {currentYear} {platformName}. Todos os direitos reservados.</p>
      </div>

      {/* Right Panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              {platformLogo ? (
                <img src={platformLogo} alt={platformName} className="w-10 h-10 rounded-xl object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                  <MessageSquare className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
              <span className="font-bold text-xl">{platformName}</span>
            </div>
            <h2 className="text-2xl font-bold">Bem-vindo de volta</h2>
            <p className="text-muted-foreground mt-2">Entre com suas credenciais para acessar o painel</p>
          </div>

          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
              <FormField control={loginForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input {...field} type="email" placeholder="seu@email.com" className="pl-9 h-11 rounded-xl" disabled={isLoading} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={loginForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Senha</FormLabel>
                    <Link to="/recuperar-senha" className="text-sm text-primary hover:underline">Esqueceu a senha?</Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input {...field} type={showPassword ? "text" : "password"} placeholder="••••••" className="pl-9 pr-9 h-11 rounded-xl" disabled={isLoading} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-base"
                style={{
                  background: 'linear-gradient(135deg, hsl(217 100% 58%) 0%, hsl(145 69% 49%) 100%)',
                }}
                disabled={isLoading}
              >
                {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</>) : "Entrar"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
