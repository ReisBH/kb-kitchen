import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtQtd } from "@/lib/fmtQtd";
import { useAuth } from "@/_core/hooks/useAuth";

function fmt(n: number | string | null | undefined, d = 4) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function ReceitaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data, isLoading } = trpc.receitas.obter.useQuery({ id: parseInt(id!) });
  const { data: custo } = trpc.receitas.custo.useQuery({ id: parseInt(id!), quantidade: parseFloat(data?.rendimentoEsperado ?? "1") }, { enabled: !!data });
  const mostrarCustos = ["admin", "head_chef", "sub_chefe"].includes(user?.role ?? "");

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="text-muted-foreground">Receita não encontrada.</div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/receitas")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="font-display text-3xl text-gold">{data.nome}</h1>
          <p className="text-muted-foreground text-sm">{data.categoria} · Rendimento: {fmt(parseFloat(data.rendimentoEsperado ?? "0"), 0)} {data.unidadeBase}{parseFloat(data.rendimentoEsperado ?? "0") <= 0 && <span className="text-warning"> · Rendimento pendente — complete os componentes para calcular o custo.</span>}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Stock Actual", value: `${fmt(data.stockAtual, 2)} ${data.unidadeBase}` },
          { label: "Custo por Lote", value: `${fmt(custo?.custoTotal, 4)} €` },
          { label: "Custo Médio", value: `${fmt(parseFloat(data.custoMedioPonderado ?? "0") * 1000, 4)} €/kg` },
          { label: "Validade", value: data.validadeProducaoDias ? `${data.validadeProducaoDias} dias` : "—" },
        ].map(({ label, value }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="font-display text-xl text-gold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Componentes</CardTitle></CardHeader>
        <CardContent>
          {(data.componentes?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Sem componentes definidos.</p> : (
            <div className="space-y-1">
              {data.componentes!.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.tipoComponente === "receita_base" ? "bg-info" : "bg-muted-foreground"}`} />
                    <div><span>{c.nomeComponente}</span>{mostrarCustos && <p className="text-[11px] text-muted-foreground">{fmt(c.custoComponente, 6)} €/ {c.unidadeBase ?? c.unidade}</p>}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0"><span className="text-muted-foreground tabular-nums">{fmtQtd(c.quantidade, c.unidade)}</span>{mostrarCustos && <span className="text-gold tabular-nums font-mono text-xs w-24 text-right">{fmt(Number(c.custoTotal ?? 0), 4)} €</span>}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
