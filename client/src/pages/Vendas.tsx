import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ShoppingCart, RotateCcw, CheckCircle, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

function fmt(n: number | string, d = 2) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Vendas() {
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [confirmado, setConfirmado] = useState(false);
  const [isWaste, setIsWaste] = useState(false);
  const utils = trpc.useUtils();
  const { data: fichas, isLoading } = trpc.fichas.listar.useQuery();
  const { data: vendas } = trpc.fichas.listarVendas.useQuery();

  const registar = trpc.fichas.registarVenda.useMutation({
    onSuccess: (d) => {
      if (d.isWaste) {
        toast.success(
          `Waste registado — stock deduzido como quebra.` +
          (d.stockNegativo.length > 0 ? ` ⚠️ Stock negativo: ${d.stockNegativo.join(", ")}` : "")
        );
      } else {
        toast.success(
          `Venda registada — Food Cost: ${fmt(d.foodCostPct, 1)}%` +
          (d.stockNegativo.length > 0 ? ` ⚠️ Stock negativo: ${d.stockNegativo.join(", ")}` : "")
        );
      }
      setQuantidades({});
      setConfirmado(false);
      utils.fichas.listarVendas.invalidate();
      utils.dashboard.resumo.invalidate();
      utils.artigos.listar.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Group fichas by section
  const fichasPorSeccao = useMemo(() => {
    if (!fichas) return {};
    return fichas.reduce((acc, f) => {
      const sec = f.secaoMenu ?? "Outros";
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(f);
      return acc;
    }, {} as Record<string, typeof fichas>);
  }, [fichas]);

  const linhasComQuantidade = useMemo(() =>
    Object.entries(quantidades)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([id, v]) => ({ fichaId: parseInt(id), quantidade: parseFloat(v) })),
    [quantidades]
  );

  const totalDoses = linhasComQuantidade.reduce((s, l) => s + l.quantidade, 0);

  function limpar() {
    setQuantidades({});
    setConfirmado(false);
    setIsWaste(false);
  }

  function submeter() {
    if (linhasComQuantidade.length === 0) {
      toast.error("Preenche pelo menos uma quantidade.");
      return;
    }
    registar.mutate({ linhas: linhasComQuantidade, isWaste });
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold">Registo de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Preenche as quantidades vendidas e confirma em bloco</p>
        </div>
        {totalDoses > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="outline" onClick={limpar} className="border-border gap-2">
              <RotateCcw className="w-4 h-4" /> Limpar
            </Button>
            <Button onClick={submeter} disabled={registar.isPending} className="bg-primary text-primary-foreground gap-2">
              {registar.isPending
                ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> A processar…</>
                : <><CheckCircle className="w-4 h-4" /> Confirmar {totalDoses} dose(s)</>}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: dish list */}
        <div className="xl:col-span-2 space-y-4">
          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-secondary/30 animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && fichas?.length === 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Ainda não há fichas técnicas activas. Cria fichas técnicas primeiro.
              </CardContent>
            </Card>
          )}
          {Object.entries(fichasPorSeccao).map(([seccao, lista]) => (
            <Card key={seccao} className="bg-card border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">{seccao}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1">
                {lista.map(f => {
                  const qty = quantidades[f.id] ?? "";
                  const qtyNum = parseFloat(qty) || 0;
                  return (
                    <div key={f.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${qtyNum > 0 ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/30"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.nome}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {f.custoCalculado > 0 ? `${fmt(f.custoCalculado, 4)} €/dose` : "sem custo definido"}
                          {f.precoVenda && parseFloat(f.precoVenda) > 0 && (
                            <span className="ml-2 text-gold">{fmt(parseFloat(f.precoVenda))} €</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setQuantidades(prev => ({ ...prev, [f.id]: String(Math.max(0, (parseFloat(prev[f.id] ?? "0") || 0) - 1) || "") }))}
                          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-gold transition-colors text-lg leading-none"
                        >−</button>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={qty}
                          onChange={e => setQuantidades(prev => ({ ...prev, [f.id]: e.target.value }))}
                          className="w-16 h-8 text-center bg-input border-border tabular-nums text-sm"
                          placeholder="0"
                        />
                        <button
                          onClick={() => setQuantidades(prev => ({ ...prev, [f.id]: String((parseFloat(prev[f.id] ?? "0") || 0) + 1) }))}
                          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-gold transition-colors text-lg leading-none"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: summary + recent sales */}
        <div className="space-y-4">
          {/* Summary of current selection */}
          <Card className="bg-card border-border sticky top-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Resumo da Venda</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {linhasComQuantidade.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Preenche as quantidades na lista ao lado.</p>
              ) : (
                <>
                  {linhasComQuantidade.map(l => {
                    const ficha = fichas?.find(f => f.id === l.fichaId);
                    return (
                      <div key={l.fichaId} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                        <span className="truncate mr-2">{ficha?.nome}</span>
                        <span className="text-gold tabular-nums shrink-0">{l.quantidade}×</span>
                      </div>
                    );
                  })}
                  <div className="pt-2 flex justify-between text-sm font-semibold">
                    <span>Total doses</span>
                    <span className="text-gold">{totalDoses}</span>
                  </div>
                  {/* Waste toggle */}
                  <div className={`flex items-center gap-3 p-3 rounded-md border mt-2 cursor-pointer transition-colors ${isWaste ? "border-orange-500/50 bg-orange-500/10" : "border-border bg-secondary/10"}`}
                    onClick={() => setIsWaste(v => !v)}>
                    <Checkbox
                      id="waste-toggle"
                      checked={isWaste}
                      onCheckedChange={v => setIsWaste(!!v)}
                      className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <div>
                      <label htmlFor="waste-toggle" className={`text-sm font-medium cursor-pointer ${isWaste ? "text-orange-400" : "text-foreground"}`}>
                        Registar como Waste
                      </label>
                      <p className="text-xs text-muted-foreground">Deduz stock como quebra, sem impacto no faturamento</p>
                    </div>
                    {isWaste && <Trash2 className="w-4 h-4 text-orange-400 ml-auto shrink-0" />}
                  </div>
                  <Button onClick={submeter} disabled={registar.isPending} className={`w-full mt-2 gap-2 ${isWaste ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-primary text-primary-foreground"}`}>
                    {registar.isPending
                      ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> A processar…</>
                      : isWaste ? <><Trash2 className="w-4 h-4" /> Confirmar Waste</> : <><ShoppingCart className="w-4 h-4" /> Confirmar Venda</>}
                  </Button>
                  <Button variant="outline" onClick={limpar} className="w-full border-border gap-2">
                    <RotateCcw className="w-4 h-4" /> Limpar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent sales */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Vendas Recentes</CardTitle></CardHeader>
            <CardContent>
              {(vendas?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não há vendas registadas.</p>
              ) : (
                <div className="space-y-1">
                  {vendas!.slice(0, 10).map(v => (
                    <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                      <span className="text-muted-foreground text-xs">{format(new Date(v.data), "dd/MM HH:mm")}</span>
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
    </div>
  );
}

