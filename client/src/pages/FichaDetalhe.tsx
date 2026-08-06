import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtQtd } from "@/lib/fmtQtd";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function ArvoreNo({ no, depth = 0 }: { no: any; depth?: number }) {
  const pct = no.custoTotal > 0 ? no.custoTotal : 0;
  return (
    <div className={`${depth > 0 ? "ml-6 border-l border-border pl-3" : ""}`}>
      <div className="flex items-center justify-between py-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${no.tipo === "receita_base" ? "bg-info" : no.tipo === "proteina_limpa" ? "bg-warning" : "bg-muted-foreground"}`} />
          <span className={depth === 0 ? "font-medium" : "text-muted-foreground"}>{no.nome}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{fmtQtd(no.quantidade, no.unidade)}</span>
        </div>
        <span className="text-gold tabular-nums font-mono text-xs">{fmt(no.custoTotal, 4)} €</span>
      </div>
      {no.filhos?.map((f: any, i: number) => <ArvoreNo key={i} no={f} depth={depth + 1} />)}
    </div>
  );
}

export default function FichaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.fichas.obter.useQuery({ id: parseInt(id!) });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="text-muted-foreground">Ficha técnica não encontrada.</div>;

  const preco = parseFloat(data.precoVenda ?? "0");
  const custo = data.custoCalculado ?? 0;
  const margem = preco - custo;
  const foodCost = preco > 0 ? (custo / preco) * 100 : null;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fichas")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="font-display text-3xl text-gold">{data.nome}</h1>
          <p className="text-muted-foreground text-sm">{data.secaoMenu} · {data.tempoPrepMin ? `${data.tempoPrepMin} min` : ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Custo por Dose", value: `${fmt(custo, 4)} €`, highlight: true },
          { label: "Preço de Venda", value: `${fmt(preco)} €` },
          { label: "Food Cost", value: foodCost != null ? `${fmt(foodCost, 1)}%` : "—", warn: foodCost != null && foodCost > 35 },
          { label: "Margem Bruta", value: `${fmt(margem)} €`, highlight: margem > 0 },
        ].map(({ label, value, highlight, warn }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`font-display text-xl mt-1 ${warn ? "text-danger" : highlight ? "text-gold" : ""}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Explosão em Cascata — Árvore de Composição</CardTitle>
        </CardHeader>
        <CardContent>
          {(data.arvore?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há componentes nesta ficha técnica.</p>
          ) : (
            <div className="space-y-1">
              {data.arvore!.map((no, i) => <ArvoreNo key={i} no={no} />)}
              <div className="flex justify-between pt-3 border-t border-border mt-3">
                <span className="font-medium text-sm">Total por dose</span>
                <span className="font-display text-gold tabular-nums">{fmt(custo, 4)} €</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
