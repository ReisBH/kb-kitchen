import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

function fmt(n: number | string, d = 2) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

type Linha = { fichaId: number; fichaNome: string; quantidade: number; precoUnitario?: number };

export default function Vendas() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [fichaId, setFichaId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const utils = trpc.useUtils();
  const { data: fichas } = trpc.fichas.listar.useQuery();
  const { data: vendas } = trpc.fichas.listarVendas.useQuery();
  const registar = trpc.fichas.registarVenda.useMutation({
    onSuccess: (d) => {
      toast.success(`Venda registada — Food Cost: ${fmt(d.foodCostPct, 1)}%${d.stockNegativo.length > 0 ? ` ⚠️ Stock negativo: ${d.stockNegativo.join(", ")}` : ""}`);
      setLinhas([]);
      utils.fichas.listarVendas.invalidate();
      utils.dashboard.resumo.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function adicionarLinha() {
    const ficha = fichas?.find(f => f.id === parseInt(fichaId));
    if (!ficha) return;
    setLinhas(prev => [...prev, { fichaId: ficha.id, fichaNome: ficha.nome, quantidade: parseFloat(quantidade) || 1 }]);
    setFichaId(""); setQuantidade("1");
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-3xl text-gold">Registo de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Entrada manual de vendas — desencadeia a explosão de stock</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Nova Venda</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={fichaId} onValueChange={setFichaId}>
                <SelectTrigger className="flex-1 bg-input border-border"><SelectValue placeholder="Seleccionar ficha técnica…" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {fichas?.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={quantidade} onChange={e => setQuantidade(e.target.value)} type="number" min="0.5" step="0.5"
                className="w-20 bg-input border-border text-center" placeholder="Qtd" />
              <Button onClick={adicionarLinha} disabled={!fichaId} className="bg-secondary text-foreground border border-border">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {linhas.length > 0 && (
              <div className="space-y-2">
                {linhas.map((l, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border">
                    <div><p className="text-sm font-medium">{l.fichaNome}</p><p className="text-xs text-muted-foreground">{l.quantidade} dose(s)</p></div>
                    <button onClick={() => setLinhas(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button className="w-full bg-primary text-primary-foreground mt-2" disabled={registar.isPending}
                  onClick={() => registar.mutate({ linhas: linhas.map(l => ({ fichaId: l.fichaId, quantidade: l.quantidade })) })}>
                  {registar.isPending ? "A processar…" : "Registar Venda e Dar Quebra de Stock"}
                </Button>
              </div>
            )}
            {linhas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Adiciona fichas técnicas para registar a venda.</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Vendas Recentes</CardTitle></CardHeader>
          <CardContent>
            {(vendas?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Ainda não há vendas registadas.</p> : (
              <div className="space-y-2">
                {vendas!.slice(0, 10).map(v => (
                  <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                    <span className="text-muted-foreground">{format(new Date(v.data), "dd/MM/yyyy")}</span>
                    <div className="text-right tabular-nums">
                      <span className="text-gold">{fmt(parseFloat(v.totalReceita ?? "0"))} €</span>
                      <span className="text-muted-foreground text-xs ml-2">FC: {fmt(parseFloat(v.foodCostPct ?? "0"), 1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

