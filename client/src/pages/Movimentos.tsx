import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ClipboardList, Pencil, Trash2, X, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TIPOS: Record<string, string> = {
  entrada_compra: "Entrada de compra",
  producao_consumo: "Consumo de produção",
  producao_entrada: "Entrada de produção",
  venda_consumo: "Consumo de venda",
  quebra: "Quebra",
  transformacao_saida: "Transformação — saída",
  transformacao_entrada: "Transformação — entrada",
  ajuste_inventario: "Ajuste de inventário",
};

type MovItem = {
  id: number;
  artigoNome: string | null;
  artigoUnidade: string | null;
  tipo: string;
  quantidade: string;
  custoUnitario: string;
  stockApos: string | null;
  documentoId: string | null;
  dataMovimento: Date;
  motivo: string | null;
};

function EditDialog({ mov, onClose }: { mov: MovItem; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [quantidade, setQuantidade] = useState(parseFloat(mov.quantidade).toString());
  const [custo, setCusto] = useState(parseFloat(mov.custoUnitario).toString());
  const [motivo, setMotivo] = useState(mov.motivo ?? "");
  const [tipo, setTipo] = useState(mov.tipo);

  const editar = trpc.movimentos.editar.useMutation({
    onSuccess: () => {
      toast.success("Movimento actualizado");
      utils.movimentos.listar.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DialogContent className="bg-card border-border max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-xl text-gold">Editar Movimento #{mov.id}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Artigo</label>
          <p className="text-sm font-medium">{mov.artigoNome}</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="bg-input border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {Object.entries(TIPOS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantidade ({mov.artigoUnidade})</label>
            <Input type="number" step="any" value={quantidade} onChange={e => setQuantidade(e.target.value)}
              className="bg-input border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Custo unit. (€/{mov.artigoUnidade === "g" ? "kg→g" : mov.artigoUnidade === "ml" ? "l→ml" : mov.artigoUnidade})
            </label>
            <Input type="number" step="any" min="0" value={custo} onChange={e => setCusto(e.target.value)}
              className="bg-input border-border" />
            <p className="text-xs text-muted-foreground mt-1">
              Valor em €/{mov.artigoUnidade} (ex: 0.004200 para 4,20€/kg)
            </p>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Motivo / Observação</label>
          <Input value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Motivo da correcção…" className="bg-input border-border" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 border-border" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground"
            disabled={editar.isPending}
            onClick={() => editar.mutate({
              id: mov.id,
              quantidade: parseFloat(quantidade),
              custoUnitario: parseFloat(custo),
              motivo: motivo || undefined,
              tipo: tipo as any,
            })}
          >
            {editar.isPending ? "A guardar…" : <><Check className="w-4 h-4 mr-1" /> Guardar</>}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function Movimentos() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("todos");
  const [editMov, setEditMov] = useState<MovItem | null>(null);
  const [deleteMov, setDeleteMov] = useState<MovItem | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.movimentos.listar.useQuery({
    tipo: tipo !== "todos" ? tipo : undefined,
    limite: 200,
  });

  const eliminar = trpc.movimentos.eliminar.useMutation({
    onSuccess: () => {
      toast.success("Movimento eliminado");
      utils.movimentos.listar.invalidate();
      utils.artigos.listar.invalidate();
      utils.dashboard.resumo.invalidate();
      setDeleteMov(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const canEdit = user?.role === "admin" || user?.role === "head_chef";

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold">Livro de Movimentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} movimentos</p>
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-52 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {canEdit && (
        <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-3 py-2">
          ⚠️ Tens permissão para editar e eliminar movimentos. Estas acções afectam directamente o stock calculado e não podem ser desfeitas.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-card rounded animate-pulse" />)}</div>
      ) : (data?.items?.length ?? 0) === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Ainda não há movimentos registados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Data", "Artigo", "Tipo", "Quantidade", "Custo Unit.", "Stock Após", "Motivo/Doc.", ...(canEdit ? ["Acções"] : [])].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.items.map(m => (
                <tr key={m.id} className="border-b border-border hover:bg-secondary/30 group">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(m.dataMovimento), "dd/MM/yy HH:mm")}</td>
                  <td className="px-4 py-2.5 font-medium">{m.artigoNome}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{TIPOS[m.tipo] ?? m.tipo}</td>
                  <td className={cn("px-4 py-2.5 font-mono", parseFloat(m.quantidade) > 0 ? "text-success" : "text-danger")}>
                    {parseFloat(m.quantidade) > 0 ? "+" : ""}{parseFloat(m.quantidade).toFixed(1)} {m.artigoUnidade}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">
                    {m.artigoUnidade === "g"
                      ? `${(parseFloat(m.custoUnitario) * 1000).toFixed(2)} €/kg`
                      : m.artigoUnidade === "ml"
                      ? `${(parseFloat(m.custoUnitario) * 1000).toFixed(2)} €/l`
                      : `${parseFloat(m.custoUnitario).toFixed(4)} €/un`}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{m.stockApos != null ? parseFloat(m.stockApos).toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">{m.motivo ?? m.documentoId ?? "—"}</td>
                  {canEdit && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-gold"
                          onClick={() => setEditMov(m as any)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-danger"
                          onClick={() => setDeleteMov(m as any)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editMov} onOpenChange={open => { if (!open) setEditMov(null); }}>
        {editMov && <EditDialog mov={editMov} onClose={() => setEditMov(null)} />}
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteMov} onOpenChange={open => { if (!open) setDeleteMov(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gold font-display">Eliminar Movimento?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Vais eliminar o movimento <strong className="text-foreground">#{deleteMov?.id}</strong> de{" "}
              <strong className="text-foreground">{deleteMov?.artigoNome}</strong> ({parseFloat(deleteMov?.quantidade ?? "0").toFixed(1)} {deleteMov?.artigoUnidade}).
              <br /><br />
              <span className="text-warning">⚠️ Esta acção não pode ser desfeita. O stock calculado será afectado.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteMov && eliminar.mutate({ id: deleteMov.id })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
