import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Aprovacoes() {
  const utils = trpc.useUtils();
  const { data: pendentes, isLoading } = trpc.receitas.listarAprovacoesPendentes.useQuery();
  const decidir = trpc.receitas.decidirProducao.useMutation({
    onSuccess: (resultado) => {
      toast.success(resultado.estado === "aprovada" ? `Produção aprovada; lote ${resultado.codigoLote} criado.` : "Produção rejeitada sem movimentar stock.");
      utils.receitas.listarAprovacoesPendentes.invalidate();
      utils.receitas.historicoProducoes.invalidate();
      utils.artigos.listar.invalidate();
    },
    onError: (erro) => toast.error(erro.message),
  });

  const rejeitar = (producaoId: number) => {
    const motivo = window.prompt("Indica o motivo obrigatório da rejeição:");
    if (motivo?.trim()) decidir.mutate({ producaoId, aprovar: false, motivo: motivo.trim() });
    else if (motivo !== null) toast.error("Indica um motivo para rejeitar.");
  };

  return <div className="space-y-6 animate-in"><div><h1 className="font-display text-3xl text-gold">Aprovações Operacionais</h1><p className="text-muted-foreground text-sm mt-1">Produções só movimentam stock e criam lote após decisão de uma chefia diferente do solicitante.</p></div>{isLoading ? <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-28 bg-card rounded animate-pulse" />)}</div> : !(pendentes?.length) ? <Card className="bg-card border-border"><CardContent className="py-14 text-center"><ShieldCheck className="w-10 h-10 mx-auto mb-3 text-success" /><p className="font-medium">Não existem aprovações pendentes.</p><p className="text-sm text-muted-foreground mt-1">Os próximos pedidos de produção aparecem aqui antes de afetarem o stock.</p></CardContent></Card> : <div className="space-y-3">{pendentes.map(({ aprovacao, producao, receitaNome }) => <Card key={aprovacao.id} className="bg-card border-warning/30"><CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4"><div className="flex-1"><div className="flex items-center gap-2"><p className="font-medium text-gold">{receitaNome}</p><Badge className="bg-warning/20 text-warning">Pendente</Badge></div><p className="text-sm text-muted-foreground mt-1">Produção: {fmt(producao.quantidadeProduzida, 3)} · Conservação: {producao.metodoConservacao ?? "—"} · Validade: {producao.dataValidade ? new Date(producao.dataValidade).toLocaleDateString("pt-PT") : "não definida"}</p><p className="text-xs text-muted-foreground mt-1">Custo previsto: {fmt(producao.custoLote)} € · Solicitado por utilizador #{aprovacao.solicitadoPor}</p>{producao.notas && <p className="text-xs text-muted-foreground mt-2 italic">Nota: {producao.notas}</p>}</div><div className="flex gap-2"><Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10" disabled={decidir.isPending} onClick={() => rejeitar(producao.id)}><X className="w-4 h-4 mr-1" />Rejeitar</Button><Button className="bg-primary text-primary-foreground" disabled={decidir.isPending} onClick={() => decidir.mutate({ producaoId: producao.id, aprovar: true })}><Check className="w-4 h-4 mr-1" />Aprovar</Button></div></CardContent></Card>)}</div>}</div>;
}
