import { useState, useEffect } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"manus" | "local">("local");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deveAlterarSenha, setDeveAlterarSenha] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) { toast.error("Preenche o utilizador e a senha."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Credenciais inválidas.");
        setSubmitting(false);
        return;
      }
      if (data.deveAlterarSenha) {
        setDeveAlterarSenha(true);
        setSubmitting(false);
        return;
      }
      await refresh();
      navigate("/");
    } catch {
      toast.error("Erro de ligação. Tenta novamente.");
      setSubmitting(false);
    }
  }

  if (deveAlterarSenha) {
    return <AlterarSenhaObrigatoria username={username} onSuccess={() => { refresh(); navigate("/"); }} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.012_280)_0%,oklch(0.10_0.006_280)_70%)] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-gold tracking-wide mb-2">KB Kitchen</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">Gestão de Cozinha e Fichas Técnicas</p>
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("local")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${tab === "local" ? "text-gold border-b-2 border-gold bg-accent/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              Utilizador / Senha
            </button>
            <button
              onClick={() => setTab("manus")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${tab === "manus" ? "text-gold border-b-2 border-gold bg-accent/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              Conta Manus
            </button>
          </div>

          <div className="p-7">
            {tab === "local" ? (
              <form onSubmit={handleLocalLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Utilizador</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="nome.utilizador"
                    autoComplete="username"
                    className="bg-input border-border h-11"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="bg-input border-border h-11 pr-10"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={submitting || loading} className="w-full bg-primary text-primary-foreground h-11 text-base font-medium mt-2">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> A entrar…</> : "Entrar"}
                </Button>
              </form>
            ) : (
              <div className="space-y-5 text-center">
                <p className="text-sm text-muted-foreground">Entra com a tua conta Manus para aceder ao sistema.</p>
                {loading ? (
                  <div className="flex justify-center py-2"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
                ) : (
                  <Button onClick={() => startLogin()} className="w-full bg-primary text-primary-foreground h-11 text-base font-medium gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Entrar com Manus
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Não tens conta Manus? Usa o separador <strong>Utilizador / Senha</strong>.</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 opacity-50">
          © {new Date().getFullYear()} KB Kitchen · Acesso restrito
        </p>
      </div>
    </div>
  );
}

// ─── Forced password change screen ───────────────────────────────────────────
function AlterarSenhaObrigatoria({ username, onSuccess }: { username: string; onSuccess: () => void }) {
  const [current, setCurrent] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== confirmar) { toast.error("As senhas não coincidem."); return; }
    if (nova.length < 8) { toast.error("A nova senha deve ter pelo menos 8 caracteres."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/local/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: nova }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao alterar senha."); setSubmitting(false); return; }
      toast.success("Senha alterada com sucesso. A entrar…");
      onSuccess();
    } catch {
      toast.error("Erro de ligação.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.012_280)_0%,oklch(0.10_0.006_280)_70%)] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-gold mb-2">KB Kitchen</h1>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-7 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Alterar Senha Obrigatória</h2>
            <p className="text-sm text-muted-foreground">O administrador requer que alteres a tua senha antes de continuar.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Senha actual</Label>
              <Input type={showPw ? "text" : "password"} value={current} onChange={e => setCurrent(e.target.value)} className="bg-input border-border h-11" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input type={showPw ? "text" : "password"} value={nova} onChange={e => setNova(e.target.value)} className="bg-input border-border h-11" placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input type={showPw ? "text" : "password"} value={confirmar} onChange={e => setConfirmar(e.target.value)} className="bg-input border-border h-11" placeholder="Repetir senha" />
            </div>
            <button type="button" onClick={() => setShowPw(v => !v)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showPw ? "Ocultar" : "Mostrar"} senhas
            </button>
            <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground h-11">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> A alterar…</> : "Alterar Senha e Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
