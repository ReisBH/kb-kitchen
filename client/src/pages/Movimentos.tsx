import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ClipboardList, Undo2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  documentoTipo: string | null;
  dataMovimento: Date;
  motivo: string | null;
  anuladoEm: Date | null;
  anuladoPorMovimentoId: number | null;
};

export default function Movimentos() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("todos");
  const [estornoMov, setEstornoMov] = useState<MovItem | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.movimentos.listar.useQuery({
    tipo: tipo !== "todos" ? tipo : undefined,
    limite: 200,
  });

  const estornar = trpc.movimentos.estornar.useMutation({
    onSuccess: () => {
      toast.success("Movimento estornado com registo de auditoria");
      utils.movimentos.listar.invalidate();
      utils.artigos.listar.invalidate();
      utils.dashboard.resumo.invalidate();
      setEstornoMov(null);
      setMotivoEstorno("");
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
          O livro é imutável: movimentos confirmados não são editados nem eliminados. Usa estorno com motivo para criar o movimento inverso auditável.
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
                <tr key={m.id} className={cn("border-b border-border hover:bg-secondary/30 group", m.anuladoEm && "opacity-55")}>
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
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                    {m.anuladoEm ? `Estornado · ${m.motivo ?? ""}` : (m.motivo ?? m.documentoId ?? "—")}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!m.anuladoEm && m.documentoTipo !== "estorno" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-warning"
                            title="Estornar movimento" onClick={() => setEstornoMov(m as any)}>
                            <Undo2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!estornoMov} onOpenChange={open => { if (!open) setEstornoMov(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gold font-display">Estornar Movimento?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Vais criar um movimento inverso para <strong className="text-foreground">#{estornoMov?.id}</strong> de{" "}
              <strong className="text-foreground">{estornoMov?.artigoNome}</strong> ({parseFloat(estornoMov?.quantidade ?? "0").toFixed(1)} {estornoMov?.artigoUnidade}).
              <br /><br />
              <span className="text-warning">O original será preservado e marcado como estornado.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={motivoEstorno} onChange={event => setMotivoEstorno(event.target.value)}
            placeholder="Motivo obrigatório do estorno" className="bg-input border-border" />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-black hover:bg-warning/90"
              disabled={motivoEstorno.trim().length < 3 || estornar.isPending}
              onClick={() => estornoMov && estornar.mutate({ id: estornoMov.id, motivo: motivoEstorno.trim() })}
            >
              {estornar.isPending ? "A estornar…" : "Confirmar estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
