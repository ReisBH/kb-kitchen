import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ClipboardList } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function Movimentos() {
  const [tipo, setTipo] = useState("todos");
  const { data, isLoading } = trpc.movimentos.listar.useQuery({ tipo: tipo !== "todos" ? tipo : undefined, limite: 200 });
  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-3xl text-gold">Livro de Movimentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} movimentos</p></div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-52 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <div className="space-y-2">{[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-card rounded animate-pulse" />)}</div>
        : (data?.items?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Ainda não há movimentos registados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Data", "Artigo", "Tipo", "Quantidade", "Custo Unit.", "Stock Após", "Documento"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.items.map(m => (
                  <tr key={m.id} className="border-b border-border hover:bg-secondary/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(m.dataMovimento), "dd/MM/yy HH:mm")}</td>
                    <td className="px-4 py-2.5 font-medium">{m.artigoNome}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{TIPOS[m.tipo] ?? m.tipo}</td>
                    <td className={cn("px-4 py-2.5 font-mono", parseFloat(m.quantidade) > 0 ? "text-success" : "text-danger")}>
                      {parseFloat(m.quantidade) > 0 ? "+" : ""}{parseFloat(m.quantidade).toFixed(3)} {m.artigoUnidade}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{parseFloat(m.custoUnitario).toFixed(4)} €</td>
                    <td className="px-4 py-2.5 font-mono">{m.stockApos != null ? parseFloat(m.stockApos).toFixed(2) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.documentoId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

