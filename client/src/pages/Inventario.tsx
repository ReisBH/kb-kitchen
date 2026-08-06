import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Inventario() {
  const utils = trpc.useUtils();
  const { data: inventarios, isLoading } = trpc.inventario.listar.useQuery();
  const [activeId, setActiveId] = useState<number | null>(null);
  const { data: invAtivo } = trpc.inventario.obter.useQuery({ id: activeId! }, { enabled: !!activeId });
  const [contagens, setContagens] = useState<Record<number, string>>({});

  const iniciar = trpc.inventario.iniciar.useMutation({
    onSuccess: (d) => { toast.success("Inventário iniciado"); setActiveId(d.id); utils.inventario.listar.invalidate(); },
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
  const [showDesviosDialog, setShowDesviosDialog] = useState(false);
  const [desviosPendentes, setDesviosPendentes] = useState<any[]>([]);

  const { refetch: verificarDesvios } = trpc.inventario.verificarDesvios.useQuery(
    { inventarioId: activeId! },
    { enabled: false }
  );

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
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-gold">Inventário</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Contagem física e apuramento de desvios</p></div>
        <Button className="bg-primary text-primary-foreground gap-2" onClick={() => iniciar.mutate({})} disabled={iniciar.isPending}>
          <Plus className="w-4 h-4" /> Iniciar Inventário
        </Button>
      </div>

      {activeId && invAtivo && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              {invAtivo.nome} — Em Curso
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-border gap-1"
                onClick={() => registar.mutate({ inventarioId: activeId, linhas: Object.entries(contagens).map(([artigoId, v]) => ({ artigoId: parseInt(artigoId), stockReal: parseFloat(v) || 0 })) })}>
                Guardar Contagens
              </Button>
              <Button size="sm" className="bg-danger text-white gap-1" onClick={handleFechar} disabled={fechar.isPending || registar.isPending}>
                <Lock className="w-3 h-3" /> Fechar Inventário
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-warning mb-3">⚠️ O stock teórico está oculto durante a contagem para não enviesar os resultados.</p>
            <div className="space-y-2">
              {invAtivo.linhas?.map(l => (
                <div key={l.id} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <span className="flex-1 text-sm">{l.artigoNome}</span>
                  <span className="text-xs text-muted-foreground">{l.artigoUnidade}</span>
                  <Input value={contagens[l.artigoId] ?? ""} onChange={e => setContagens(p => ({ ...p, [l.artigoId]: e.target.value }))}
                    type="number" step="0.001" placeholder="0.000" className="w-28 bg-input border-border text-right tabular-nums" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Histórico de Inventários</CardTitle></CardHeader>
        <CardContent>
          {(inventarios?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há inventários. Inicia o primeiro para apurar desvios.</p>
          ) : (
            <div className="space-y-2">
              {inventarios!.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{inv.nome}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(inv.createdAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${inv.estado === "fechado" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{inv.estado}</Badge>
                    {inv.estado === "em_curso" && <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => setActiveId(inv.id)}>Continuar</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                          <td className={`px-3 py-2 text-right font-mono \${d.desvioQtd < 0 ? "text-danger" : "text-success"}`}>
                            {d.desvioQtd > 0 ? "+" : ""}{fmt(d.desvioQtd, 1)} {d.artigoUnidade}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold \${Math.abs(d.desvioPct) > 20 ? "text-danger" : "text-warning"}`}>
                            {d.desvioPct > 0 ? "+" : ""}{fmt(d.desvioPct, 1)}%
                          </td>
                          <td className={`px-3 py-2 text-right font-mono \${d.desvioValor < 0 ? "text-danger" : "text-success"}`}>
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
              onClick={() => {
                setShowDesviosDialog(false);
                if (activeId) fechar.mutate({ inventarioId: activeId });
              }}
            >
              Confirmar e Fechar Inventário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}