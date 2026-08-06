import { trpc } from "@/lib/trpc";
import { Package, TrendingDown, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Dashboard() {
  const { data, isLoading } = trpc.dashboard.resumo.useQuery();

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-3xl text-gold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor em Stock</p>
                <p className="font-display text-2xl text-gold mt-1">{fmt(data?.valorTotalStock ?? 0)} €</p>
              </div>
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{data?.totalArtigos ?? 0} artigos activos</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Food Cost Hoje</p>
                <p className={`font-display text-2xl mt-1 ${data?.foodCostHoje != null && data.foodCostHoje > 35 ? "text-danger" : "text-gold"}`}>
                  {data?.foodCostHoje != null ? `${fmt(data.foodCostHoje, 1)}%` : "—"}
                </p>
              </div>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Receita: {fmt(data?.receitaHoje ?? 0)} €</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Abaixo do Mínimo</p>
                <p className={`font-display text-2xl mt-1 ${(data?.abaixoMinimo?.length ?? 0) > 0 ? "text-warning" : "text-success"}`}>
                  {data?.abaixoMinimo?.length ?? 0}
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">artigos a encomendar</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Stock Negativo</p>
                <p className={`font-display text-2xl mt-1 ${(data?.stockNegativo?.length ?? 0) > 0 ? "text-danger" : "text-success"}`}>
                  {data?.stockNegativo?.length ?? 0}
                </p>
              </div>
              <TrendingDown className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">artigos em negativo</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Food Cost Chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Evolução do Food Cost — 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.evolucaoFoodCost?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data!.evolucaoFoodCost}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.12 75)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.72 0.12 75)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 280)" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "oklch(0.55 0.008 80)" }}
                    tickFormatter={(v) => format(new Date(v), "dd/MM")} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.008 80)" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.14 0.008 280)", border: "1px solid oklch(0.22 0.010 280)", borderRadius: "6px" }}
                    labelStyle={{ color: "oklch(0.92 0.008 80)", fontSize: 11 }}
                    formatter={(v: number) => [`${fmt(v, 1)}%`, "Food Cost"]}
                  />
                  <Area type="monotone" dataKey="foodCostPct" stroke="oklch(0.72 0.12 75)" fill="url(#goldGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Ainda não há vendas registadas. Regista a primeira venda para ver a evolução do food cost.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              O que falta hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.abaixoMinimo?.length ?? 0) === 0 && (data?.stockNegativo?.length ?? 0) === 0 ? (
              <p className="text-sm text-success">Tudo em ordem. Nenhum artigo abaixo do mínimo.</p>
            ) : (
              <div className="space-y-2">
                {data?.stockNegativo?.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-danger">{a.nome}</span>
                    <Badge variant="destructive" className="text-xs ml-2 flex-shrink-0">negativo</Badge>
                  </div>
                ))}
                {data?.abaixoMinimo?.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{a.nome}</span>
                    <Badge className="text-xs ml-2 flex-shrink-0 bg-warning/20 text-warning border-warning/30">mínimo</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movimentos recentes */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Movimentos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.movimentosRecentes?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há movimentos. Começa por registar uma entrada de stock.</p>
          ) : (
            <div className="space-y-1">
              {data!.movimentosRecentes.slice(0, 8).map(m => (
                <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${parseFloat(m.quantidade) > 0 ? "bg-success" : "bg-danger"}`} />
                    <span className="text-muted-foreground">{m.artigoNome}</span>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className={parseFloat(m.quantidade) > 0 ? "text-success" : "text-danger"}>
                      {parseFloat(m.quantidade) > 0 ? "+" : ""}{parseFloat(m.quantidade).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.dataMovimento), "dd/MM HH:mm")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
