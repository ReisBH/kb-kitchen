import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Edit2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

function fmt(n: number | string, d = 4) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function IngredienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.artigos.obter.useQuery({ id: parseInt(id!) });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="text-muted-foreground">Artigo não encontrado.</div>;

  const historico = data.historicoCustos?.map(m => ({
    data: format(new Date(m.dataMovimento), "dd/MM"),
    custo: parseFloat(m.custoUnitario) * 1000,
  })) ?? [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ingredientes")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-display text-3xl text-gold">{data.nome}</h1>
          <p className="text-muted-foreground text-sm">{data.categoria} · {data.tipo}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Stock Actual", value: `${parseFloat(String(data.stockAtual)).toFixed(2)} ${data.unidadeBase}`, highlight: true },
          { label: "Stock Mínimo", value: `${fmt(parseFloat(data.stockMinimo ?? "0"), 2)} ${data.unidadeBase}` },
          { label: "Custo Médio", value: `${fmt(parseFloat(data.custoMedioPonderado ?? "0") * 1000)} €/kg` },
          { label: "Valor em Stock", value: `${fmt(data.stockAtual * parseFloat(data.custoMedioPonderado ?? "0"), 2)} €` },
        ].map(({ label, value, highlight }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`font-display text-xl mt-1 ${highlight ? "text-gold" : ""}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Histórico de Preços de Compra
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há entradas de compra registadas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 280)" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: "oklch(0.55 0.008 80)" }} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.008 80)" }} tickFormatter={v => `${v}€`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.008 280)", border: "1px solid oklch(0.22 0.010 280)", borderRadius: "6px" }}
                  formatter={(v: number) => [`${v.toFixed(4)} €/kg`, "Preço"]}
                />
                <Line type="monotone" dataKey="custo" stroke="oklch(0.72 0.12 75)" strokeWidth={2} dot={{ fill: "oklch(0.72 0.12 75)" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
