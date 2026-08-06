import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, ChefHat, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function ProducaoDialog({ receitaId, receitaNome, onClose }: { receitaId: number; receitaNome: string; onClose: () => void }) {
  const [qtd, setQtd] = useState("1");
  const utils = trpc.useUtils();
  const produzir = trpc.receitas.registarProducao.useMutation({
    onSuccess: (d) => {
      toast.success(`Produção registada — Custo: ${fmt(d.custoLote, 2)} € · Desvio: ${fmt(d.desvioPct, 1)}%`);
      utils.artigos.listar.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Registar produção de <strong>{receitaNome}</strong></p>
      <div><label className="text-xs text-muted-foreground mb-1 block">Quantidade produzida (unidade base)</label>
        <Input value={qtd} onChange={e => setQtd(e.target.value)} type="number" step="0.001" className="bg-input border-border" /></div>
      <Button className="w-full bg-primary text-primary-foreground" disabled={produzir.isPending}
        onClick={() => produzir.mutate({ receitaId, quantidadeProduzida: parseFloat(qtd) })}>
        {produzir.isPending ? "A produzir…" : "Registar Produção"}
      </Button>
    </div>
  );
}

export default function ReceitasBase() {
  const [producaoId, setProducaoId] = useState<{ id: number; nome: string } | null>(null);
  const { data: receitas, isLoading } = trpc.receitas.listar.useQuery();
  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-gold">Receitas Base</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{receitas?.length ?? 0} receitas</p></div>
          <Button className="bg-primary text-primary-foreground gap-2" onClick={() => toast.info("Criação de receitas base em breve.")}>
            <Plus className="w-4 h-4" /> Nova Receita
          </Button>
      </div>
      <Dialog open={!!producaoId} onOpenChange={() => setProducaoId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display text-xl text-gold">Registar Produção</DialogTitle></DialogHeader>
          {producaoId && <ProducaoDialog receitaId={producaoId.id} receitaNome={producaoId.nome} onClose={() => setProducaoId(null)} />}
        </DialogContent>
      </Dialog>
      {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-card rounded animate-pulse" />)}</div>
        : (receitas?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Ainda não há receitas base. Cria a primeira a partir dos ingredientes que já tens.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {receitas!.map(r => (
              <Card key={r.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <Link href={`/receitas/${r.id}`}>
                      <h3 className="font-medium text-gold hover:underline cursor-pointer">{r.nome}</h3>
                    </Link>
                    <Button size="sm" variant="outline" className="border-border gap-1 h-7 text-xs ml-2"
                      onClick={() => setProducaoId({ id: r.id, nome: r.nome })}>
                      <Play className="w-3 h-3" /> Produzir
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Rendimento: {fmt(parseFloat(r.rendimentoEsperado ?? "0"), 0)} {r.unidadeBase}</p>
                    <p>Validade: {r.validadeProducaoDias ?? "—"} dias</p>
                    <p>Custo médio: {fmt(parseFloat(r.custoMedioPonderado ?? "0") * 1000, 4)} €/kg</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
