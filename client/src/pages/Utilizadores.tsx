import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { UserCog, Plus, Trash2, ToggleLeft, ToggleRight, Shield, ChefHat, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ROLE_LABELS } from "@shared/permissions";
import type { AppRole } from "@shared/permissions";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="w-3.5 h-3.5" />,
  head_chef: <ChefHat className="w-3.5 h-3.5" />,
  sub_chefe: <ChefHat className="w-3.5 h-3.5" />,
  cozinheiro: <Users className="w-3.5 h-3.5" />,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-gold/20 text-gold border-gold/30",
  head_chef: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sub_chefe: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cozinheiro: "bg-green-500/20 text-green-400 border-green-500/30",
  user: "bg-secondary text-muted-foreground border-border",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acesso total — gestão de utilizadores, configurações, todos os módulos",
  head_chef: "Acesso geral à plataforma — todos os módulos excepto gestão de utilizadores",
  sub_chefe: "Acesso geral — sem alertas/encomendas e OCR de faturas",
  cozinheiro: "Acesso limitado — Fichas Técnicas, Receitas Base e Rendimento de Proteínas",
};

export default function Utilizadores() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [novoOpenId, setNovoOpenId] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoRole, setNovoRole] = useState<string>("");
  const [novoNotas, setNovoNotas] = useState("");
  const utils = trpc.useUtils();

  const { data: autorizados, isLoading } = trpc.utilizadores.listarAutorizados.useQuery();
  const { data: utilizadores } = trpc.utilizadores.listarUtilizadores.useQuery();

  const adicionar = trpc.utilizadores.adicionarAutorizado.useMutation({
    onSuccess: () => {
      toast.success("Utilizador adicionado com sucesso.");
      setDialogAberto(false);
      setNovoOpenId(""); setNovoEmail(""); setNovoNome(""); setNovoRole(""); setNovoNotas("");
      utils.utilizadores.listarAutorizados.invalidate();
      utils.utilizadores.listarUtilizadores.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const atualizarRole = trpc.utilizadores.atualizarRole.useMutation({
    onSuccess: () => { toast.success("Perfil actualizado."); utils.utilizadores.listarAutorizados.invalidate(); utils.utilizadores.listarUtilizadores.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleAtivo = trpc.utilizadores.toggleAtivo.useMutation({
    onSuccess: (_, vars) => { toast.success(vars.ativo ? "Utilizador activado." : "Utilizador desactivado."); utils.utilizadores.listarAutorizados.invalidate(); utils.utilizadores.listarUtilizadores.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const remover = trpc.utilizadores.remover.useMutation({
    onSuccess: () => { toast.success("Utilizador removido."); utils.utilizadores.listarAutorizados.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function submeterNovo() {
    if (!novoNome) { toast.error("O nome é obrigatório."); return; }
    if (!novoRole) { toast.error("Selecciona um perfil."); return; }
    if (!novoOpenId && !novoEmail) { toast.error("Fornece o OpenID Manus ou o email."); return; }
    adicionar.mutate({
      openId: novoOpenId || undefined,
      email: novoEmail || undefined,
      nome: novoNome,
      role: novoRole as any,
      notas: novoNotas || undefined,
    });
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold">Utilizadores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gestão de acessos e perfis — apenas o Administrador pode gerir utilizadores</p>
        </div>
        <Button onClick={() => setDialogAberto(true)} className="bg-primary text-primary-foreground gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Adicionar Utilizador
        </Button>
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["admin", "head_chef", "sub_chefe", "cozinheiro"] as AppRole[]).map(r => (
          <Card key={r} className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border gap-1.5 ${ROLE_COLORS[r]}`}>
                  {ROLE_ICONS[r]} {ROLE_LABELS[r]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{ROLE_DESCRIPTIONS[r]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Authorized users list */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Utilizadores Autorizados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded bg-secondary/30 animate-pulse" />)}
            </div>
          ) : (autorizados?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Ainda não há utilizadores autorizados. Adiciona o primeiro utilizador.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">OpenID / Email</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Perfil</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Adicionado em</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {autorizados!.map(u => (
                    <tr key={u.id} className={`border-b border-border last:border-0 ${!u.ativo ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-medium">{u.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {u.openId ? <span title="OpenID">{u.openId.slice(0, 16)}…</span> : u.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={u.role}
                          onValueChange={v => atualizarRole.mutate({ id: u.id, role: v as any })}
                        >
                          <SelectTrigger className="h-7 w-36 bg-input border-border text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            {(["admin", "head_chef", "sub_chefe", "cozinheiro"] as AppRole[]).map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(u.createdAt), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border ${u.ativo ? "bg-success/20 text-success border-success/30" : "bg-danger/20 text-danger border-danger/30"}`}>
                          {u.ativo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title={u.ativo ? "Desactivar" : "Activar"}
                          >
                            {u.ativo ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => { if (confirm(`Remover ${u.nome}?`)) remover.mutate({ id: u.id }); }}
                            className="text-muted-foreground hover:text-danger transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users who have logged in */}
      {(utilizadores?.length ?? 0) > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Sessões Registadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Perfil</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {utilizadores!.map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{u.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-xs border gap-1.5 ${ROLE_COLORS[u.role ?? "user"]}`}>
                          {ROLE_ICONS[u.role ?? "user"]} {ROLE_LABELS[(u.role ?? "user") as AppRole]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {format(new Date(u.lastSignedIn), "dd/MM/yyyy HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add user dialog */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-gold">Adicionar Utilizador</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Fornece o OpenID Manus do utilizador (obtido no sistema Manus) e atribui um perfil de acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome do utilizador" className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>OpenID Manus</Label>
              <Input value={novoOpenId} onChange={e => setNovoOpenId(e.target.value)} placeholder="ex: PqzmhpzLwXRLw3qkvpd7sb" className="bg-input border-border font-mono text-sm" />
              <p className="text-xs text-muted-foreground">O OpenID encontra-se no perfil do utilizador no sistema Manus.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Email (alternativo ao OpenID)</Label>
              <Input value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de Acesso *</Label>
              <Select value={novoRole} onValueChange={setNovoRole}>
                <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Seleccionar perfil…" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(["admin", "head_chef", "sub_chefe", "cozinheiro"] as AppRole[]).map(r => (
                    <SelectItem key={r} value={r}>
                      <div>
                        <p className="font-medium">{ROLE_LABELS[r]}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input value={novoNotas} onChange={e => setNovoNotas(e.target.value)} placeholder="Notas opcionais…" className="bg-input border-border" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogAberto(false)} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={submeterNovo} disabled={adicionar.isPending} className="flex-1 bg-primary text-primary-foreground">
                {adicionar.isPending ? "A adicionar…" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

