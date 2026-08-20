import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Lock, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Inventario() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "head_chef";
  const utils = trpc.useUtils();
  const { data: inventarios, isLoading } = trpc.inventario.listar.useQuery();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [idClienteNovoInventario, setIdClienteNovoInventario] = useState(() => crypto.randomUUID());
  const { data: invAtivo } = trpc.inventario.obter.useQuery({ id: activeId! }, { enabled: !!activeId });
  const [contagens, setContagens] = useState<Record<number, string>>({});

  // Mutations
  const iniciar = trpc.inventario.iniciar.useMutation({
    onSuccess: (d) => { toast.success(d.duplicado ? "Inventário já iniciado" : "Inventário iniciado"); setActiveId(d.id); setIdClienteNovoInventario(crypto.randomUUID()); utils.inventario.listar.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const registar = trpc.inventario.registarContagem.useMutation({
    onSuccess: () => { toast.success("Contagens guardadas"); utils.inventario.obter.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const fechar = trpc.inventario.fechar.useMutation({
    onSuccess: () => { toast.success("Inventário fechado. Ajustes de stock aplicados."); utils.inventario.listar.invalidate(); setActiveId(null); setShowDesviosDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const editar = trpc.inventario.editar.useMutation({
    onSuccess: () => { toast.success("Inventário actualizado"); utils.inventario.listar.invalidate(); setEditDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.inventario.eliminar.useMutation({
    onSuccess: () => { toast.success("Inventário eliminado"); utils.inventario.listar.invalidate(); setDeleteDialog(null); if (activeId === deleteDialog?.id) setActiveId(null); },
    onError: (e) => toast.error(e.message),
  });

  // Desvios dialog
  const [showDesviosDialog, setShowDesviosDialog] = useState(false);
  const [desviosPendentes, setDesviosPendentes] = useState<any[]>([]);
  const { refetch: verificarDesvios } = trpc.inventario.verificarDesvios.useQuery(
    { inventarioId: activeId! },
    { enabled: false }
  );

  // Edit dialog
  const [editDialog, setEditDialog] = useState<{ id: number; nome: string; zona: string } | null>(null);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ id: number; nome: string; estado: string } | null>(null);

  async function handleFechar() {
    if (!activeId) return;
    const linhasPendentes = Object.entries(contagens).map(([artigoId, v]) => ({
      artigoId: parseInt(artigoId),
      stockReal: parseFloat(v) || 0,
    }));
    if (linhasPendentes.length > 0) {
      await registar.mutateAsync({ inventarioId: activeId, linhas: linhasPendentes });
    }
    const result = await verificarDesvios();
    if (result.data?.temDesviosSignificativos) {
      setDesviosPendentes(result.data.desvios);
      setShowDesviosDialog(true);
    } else {
      fechar.mutate({ inventarioId: activeId });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary">Inventário</h1>
          <p className="text-muted-foreground text-sm mt-1">Contagem física e ajuste de stock</p>
        </div>
        <Button onClick={() => iniciar.mutate({ idCliente: idClienteNovoInventario })} disabled={iniciar.isPending} className="bg-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" /> Novo Inventário
        </Button>
      </div>

      {/* Active inventory counting sheet */}
      {activeId && invAtivo && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg text-primary">{invAtivo.nome ?? "Inventário em curso"}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-border h-8 text-xs gap-1" onClick={() => {
                  const linhas = Object.entries(contagens).map(([artigoId, v]) => ({ artigoId: parseInt(artigoId), stockReal: parseFloat(v) || 0 }));
                  if (linhas.length > 0) registar.mutate({ inventarioId: activeId, linhas });
                  else toast.info("Sem contagens para guardar");
                }}>Guardar Contagens</Button>
                <Button size="sm" className="bg-primary text-primary-foreground h-8 text-xs gap-1" onClick={handleFechar} disabled={fechar.isPending}>
                  <Lock className="w-3 h-3" /> Fechar Inventário
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground uppercase text-xs tracking-wide">Artigo</th>
                    <th className="text-right py-2 px-3 text-muted-foreground uppercase text-xs tracking-wide">Stock Teórico</th>
                    <th className="text-right py-2 px-3 text-muted-foreground uppercase text-xs tracking-wide">Contagem Real</th>
                    <th className="text-right py-2 px-3 text-muted-foreground uppercase text-xs tracking-wide">Desvio</th>
                    <th className="text-right py-2 px-3 text-muted-foreground uppercase text-xs tracking-wide">Desvio %</th>
                  </tr>
                </thead>
                <tbody>
                  {invAtivo.linhas.map((l: any) => {
                    const real = contagens[l.artigoId] !== undefined ? parseFloat(contagens[l.artigoId]) || 0 : (l.stockReal != null ? parseFloat(l.stockReal) : null);
                    const teorico = parseFloat(l.stockTeorico ?? "0");
                    const desvio = real != null ? real - teorico : null;
                    const desvioPct = teorico !== 0 && desvio != null ? (desvio / teorico) * 100 : null;
                    return (
                      <tr key={l.artigoId} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                        <td className="py-2 px-3 font-medium">{l.artigoNome}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">{fmt(teorico, 2)} {l.artigoUnidade}</td>
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={contagens[l.artigoId] ?? (l.stockReal != null ? String(parseFloat(l.stockReal)) : "")}
                            onChange={e => setContagens(prev => ({ ...prev, [l.artigoId]: e.target.value }))}
                            className="h-7 w-28 text-right bg-input border-border text-sm ml-auto tabular-nums"
                            placeholder="0"
                          />
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums font-mono text-sm ${desvio == null ? "" : desvio < 0 ? "text-danger" : desvio > 0 ? "text-success" : "text-muted-foreground"}`}>
                          {desvio == null ? "—" : `${desvio > 0 ? "+" : ""}${fmt(desvio, 2)} ${l.artigoUnidade}`}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums font-mono text-sm ${desvioPct == null ? "" : Math.abs(desvioPct) > 20 ? "text-danger" : Math.abs(desvioPct) > 5 ? "text-warning" : "text-muted-foreground"}`}>
                          {desvioPct == null ? "—" : `${desvioPct > 0 ? "+" : ""}${fmt(desvioPct, 1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory list */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg text-primary">Histórico de Inventários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">A carregar…</p>
          ) : !inventarios?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum inventário registado.</p>
          ) : (
            <div className="space-y-1">
              {inventarios.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between py-3 px-2 border-b border-border last:border-0 group hover:bg-secondary/10 rounded">
                  <div>
                    <p className="text-sm font-medium">{inv.nome}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(inv.createdAt), "dd/MM/yyyy HH:mm")}{inv.zona ? ` · ${inv.zona}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${inv.estado === "fechado" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{inv.estado === "fechado" ? "Fechado" : "Em curso"}</Badge>
                    {inv.estado === "em_curso" && (
                      <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => setActiveId(inv.id)}>Continuar</Button>
                    )}
                    {canEdit && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                          onClick={() => setEditDialog({ id: inv.id, nome: inv.nome ?? "", zona: inv.zona ?? "" })}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {inv.estado === "em_curso" && <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-danger"
                          onClick={() => setDeleteDialog({ id: inv.id, nome: inv.nome ?? `Inventário #${inv.id}`, estado: inv.estado })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary">Editar Inventário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input
                value={editDialog?.nome ?? ""}
                onChange={e => setEditDialog(prev => prev ? { ...prev, nome: e.target.value } : null)}
                className="bg-input border-border"
                placeholder="ex: Inventário semanal"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Zona</label>
              <Input
                value={editDialog?.zona ?? ""}
                onChange={e => setEditDialog(prev => prev ? { ...prev, zona: e.target.value } : null)}
                className="bg-input border-border"
                placeholder="ex: Cozinha fria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={editar.isPending}
              onClick={() => editDialog && editar.mutate({ id: editDialog.id, nome: editDialog.nome, zona: editDialog.zona })}
            >
              {editar.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-danger flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Eliminar Inventário
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Tens a certeza que queres eliminar <strong className="text-foreground">"{deleteDialog?.nome}"</strong>?
                  Esta acção não pode ser desfeita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteDialog && eliminar.mutate({ id: deleteDialog.id })}
            >
              {eliminar.isPending ? "A eliminar…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Desvios >5% warning dialog */}
      <AlertDialog open={showDesviosDialog} onOpenChange={setShowDesviosDialog}>
        <AlertDialogContent className="bg-card border-border max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-warning flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Desvios Significativos Detectados
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Os seguintes artigos apresentam desvios superiores a <strong className="text-warning">5%</strong> face ao stock teórico.
                  Confirma se pretendes fechar o inventário e aplicar estes ajustes de stock.
                </p>
                <div className="max-h-64 overflow-y-auto rounded border border-border">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="bg-secondary/50 border-b border-border">
                        <th className="text-left px-3 py-2 text-muted-foreground uppercase tracking-wide">Artigo</th>
                        <th className="text-right px-3 py-2 text-muted-foreground uppercase tracking-wide">Teórico</th>
                        <th className="text-right px-3 py-2 text-muted-foreground uppercase tracking-wide">Real</th>
                        <th className="text-right px-3 py-2 text-muted-foreground uppercase tracking-wide">Desvio</th>
                        <th className="text-right px-3 py-2 text-muted-foreground uppercase tracking-wide">%</th>
                        <th className="text-right px-3 py-2 text-muted-foreground uppercase tracking-wide">Valor €</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desviosPendentes.map((d: any) => (
                        <tr key={d.artigoId} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium">{d.artigoNome}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(d.stockTeorico, 1)} {d.artigoUnidade}</td>
                          <td className="px-3 py-2 text-right">{fmt(d.stockReal, 1)} {d.artigoUnidade}</td>
                          <td className={`px-3 py-2 text-right font-mono ${d.desvioQtd < 0 ? "text-danger" : "text-success"}`}>
                            {d.desvioQtd > 0 ? "+" : ""}{fmt(d.desvioQtd, 1)} {d.artigoUnidade}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold ${Math.abs(d.desvioPct) > 20 ? "text-danger" : "text-warning"}`}>
                            {d.desvioPct > 0 ? "+" : ""}{fmt(d.desvioPct, 1)}%
                          </td>
                          <td className={`px-3 py-2 text-right font-mono ${d.desvioValor < 0 ? "text-danger" : "text-success"}`}>
                            {d.desvioValor > 0 ? "+" : ""}{fmt(d.desvioValor, 2)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total de artigos com desvio &gt;5%: <strong className="text-warning">{desviosPendentes.length}</strong>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Rever Contagens</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => { setShowDesviosDialog(false); if (activeId) fechar.mutate({ inventarioId: activeId }); }}
            >
              Confirmar e Fechar Inventário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
