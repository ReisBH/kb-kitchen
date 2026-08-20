import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fmtQtd } from "@/lib/fmtQtd";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function ArvoreNo({ no, depth = 0, mostrarCustos }: { no: any; depth?: number; mostrarCustos: boolean }) {
  return (
    <div className={`${depth > 0 ? "ml-6 border-l border-border pl-3" : ""}`}>
      <div className="flex items-center justify-between py-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${no.tipo === "receita_base" ? "bg-info" : no.tipo === "proteina_limpa" ? "bg-warning" : "bg-muted-foreground"}`} />
          <span className={depth === 0 ? "font-medium" : "text-muted-foreground"}>{no.nome}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{fmtQtd(no.quantidadeReferencia ?? no.quantidade, no.unidade)}</span>
        </div>
        {mostrarCustos && <div className="text-right shrink-0"><span className="text-[11px] text-muted-foreground font-mono">{fmt(no.custoUnitario, 6)} €/ {no.unidadeCusto ?? no.unidade}</span><span className="block text-gold tabular-nums font-mono text-xs">{fmt(no.custoTotal, 4)} €</span></div>}
      </div>
      {no.filhos?.map((f: any, i: number) => <ArvoreNo key={i} no={f} depth={depth + 1} mostrarCustos={mostrarCustos} />)}
    </div>
  );
}

export default function FichaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.fichas.obter.useQuery({ id: parseInt(id!) });
  const publicar = trpc.fichas.publicar.useMutation({
    onSuccess: () => { toast.success("Ficha técnica publicada para vendas e POS."); utils.fichas.obter.invalidate({ id: parseInt(id!) }); utils.fichas.listar.invalidate(); },
    onError: (erro) => toast.error(erro.message),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="text-muted-foreground">Ficha técnica não encontrada.</div>;

  const preco = parseFloat(data.precoVenda ?? "0");
  const custo = data.custoCalculado ?? 0;
  const margem = preco - custo;
  const foodCost = preco > 0 ? (custo / preco) * 100 : null;
  const mostrarCustos = ["admin", "head_chef", "sub_chefe"].includes(user?.role ?? "");
  const podePublicar = ["admin", "head_chef"].includes(user?.role ?? "") && data.estadoPublicacao !== "publicada";

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fichas")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="font-display text-3xl text-gold">{data.nome}</h1>
          <p className="text-muted-foreground text-sm">{data.secaoMenu} · {data.tempoPrepMin ? `${data.tempoPrepMin} min` : ""}</p>
        </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={data.estadoPublicacao === "publicada" ? "bg-success/20 text-success" : data.estadoPublicacao === "em_revisao" ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}>{data.estadoPublicacao === "publicada" ? "Publicada" : data.estadoPublicacao === "em_revisao" ? "Em revisão" : "Rascunho"}</Badge>
          {podePublicar && <Button size="sm" className="bg-primary text-primary-foreground" disabled={publicar.isPending} onClick={() => publicar.mutate({ fichaId: data.id })}>{publicar.isPending ? "A publicar…" : "Publicar"}</Button>}
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
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Explosão em Cascata — Árvore de Composição{mostrarCustos ? " e Custos" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {(data.arvore?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há componentes nesta ficha técnica.</p>
          ) : (
            <div className="space-y-1">
              {data.arvore!.map((no, i) => <ArvoreNo key={i} no={no} mostrarCustos={mostrarCustos} />)}
              <div className="flex justify-between pt-3 border-t border-border mt-3">
                <span className="font-medium text-sm">Total por dose</span>
                {mostrarCustos && <span className="font-display text-gold tabular-nums">{fmt(custo, 4)} €</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
