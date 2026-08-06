import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.012_280)_0%,oklch(0.10_0.006_280)_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl text-gold tracking-wide mb-2">Economato</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">Gestão de Stock e Fichas Técnicas</p>
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold">Bem-vindo</h2>
            <p className="text-sm text-muted-foreground">
              O acesso a este sistema é restrito. Faz login com a tua conta Manus para continuar.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : (
            <Button
              onClick={() => startLogin()}
              className="w-full bg-primary text-primary-foreground h-11 text-base font-medium gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Entrar com Manus
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Não tens acesso? Contacta o administrador do sistema.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 opacity-50">
          © {new Date().getFullYear()} Economato · Acesso restrito
        </p>
      </div>
    </div>
  );
}

