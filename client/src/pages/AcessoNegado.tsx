import { useAuth } from "@/_core/hooks/useAuth";
import { ShieldX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ROLE_LABELS } from "@shared/permissions";
import type { AppRole } from "@shared/permissions";

export default function AcessoNegado() {
  const { user, logout } = useAuth();
  const role = (user?.role ?? "user") as AppRole;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.012_280)_0%,oklch(0.10_0.006_280)_70%)] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-danger" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-gold">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Não tens permissão para aceder a esta página.
          </p>
          {user && (
            <p className="text-sm text-muted-foreground">
              O teu perfil é <span className="text-foreground font-medium">{ROLE_LABELS[role]}</span>.
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button className="bg-primary text-primary-foreground">Ir para o Dashboard</Button>
          </Link>
          <Button variant="outline" onClick={logout} className="border-border gap-2">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

