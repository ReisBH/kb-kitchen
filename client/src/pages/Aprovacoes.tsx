import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { imprimirEtiquetaLote } from "@/lib/imprimirEtiquetaLote";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Aprovacoes() {
  const utils = trpc.useUtils();
  const producoes = trpc.receitas.listarAprovacoesPendentes.useQuery();
  const inventarios = trpc.inventario.listarAprovacoesPendentes.useQuery();
  const decidirProducao = trpc.receitas.decidirProducao.useMutation({
    onSuccess: (resultado) => { toast.success(resultado.estado === "aprovada" ? `Produção aprovada; lote ${resultado.codigoLote} criado.` : "Produção rejeitada sem movimentar stock."); if ("etiqueta" in resultado && resultado.etiqueta) imprimirEtiquetaLote(resultado.etiqueta); utils.receitas.listarAprovacoesPendentes.invalidate(); utils.receitas.historicoProducoes.invalidate(); utils.artigos.listar.invalidate(); },
    onError: (erro) => toast.error(erro.message),
  });
  const decidirInventario = trpc.inventario.decidirAprovacao.useMutation({
    onSuccess: (resultado) => { toast.success(resultado.estado === "aprovada" ? "Inventário aprovado; ajustes aplicados no livro de movimentos." : "Inventário rejeitado e devolvido para revisão."); utils.inventario.listarAprovacoesPendentes.invalidate(); utils.inventario.listar.invalidate(); },
    onError: (erro) => toast.error(erro.message),
  });
  const rejeitar = (tipo: "producao" | "inventario", id: number) => {
    const motivo = window.prompt("Indica o motivo obrigatório da rejeição:");
    if (!motivo?.trim()) { if (motivo !== null) toast.error("Indica um motivo para rejeitar."); return; }
    if (tipo === "producao") decidirProducao.mutate({ producaoId: id, aprovar: false, motivo: motivo.trim() });
    else decidirInventario.mutate({ inventarioId: id, aprovar: false, motivo: motivo.trim() });
  };
  const aCarregar = producoes.isLoading || inventarios.isLoading;
  const semPendentes = !(producoes.data?.length) && !(inventarios.data?.length);
  return <div className="space-y-6 animate-in"><div><h1 className="font-display text-3xl text-gold">Aprovações Operacionais</h1><p className="text-muted-foreground text-sm mt-1">O solicitante nunca pode decidir o próprio pedido. As operações só alteram stock depois de aprovadas.</p></div>{aCarregar ? <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-28 bg-card rounded animate-pulse" />)}</div> : semPendentes ? <Card className="bg-card border-border"><CardContent className="py-14 text-center"><ShieldCheck className="w-10 h-10 mx-auto mb-3 text-success" /><p className="font-medium">Não existem aprovações pendentes.</p><p className="text-sm text-muted-foreground mt-1">Pedidos críticos de produção e inventário aparecem aqui antes de afetarem o stock.</p></CardContent></Card> : <div className="space-y-6">{(producoes.data?.length ?? 0) > 0 && <section className="space-y-3"><h2 className="text-sm uppercase tracking-wide text-muted-foreground">Produções por lote</h2>{producoes.data?.map(({ aprovacao, producao, receitaNome }) => <Card key={`p-${aprovacao.id}`} className="bg-card border-warning/30"><CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4"><div className="flex-1"><div className="flex items-center gap-2"><p className="font-medium text-gold">{receitaNome}</p><Badge className="bg-warning/20 text-warning">Pendente</Badge></div><p className="text-sm text-muted-foreground mt-1">Produção: {fmt(producao.quantidadeProduzida, 3)} · Conservação: {producao.metodoConservacao ?? "—"} · Validade: {producao.dataValidade ? new Date(producao.dataValidade).toLocaleDateString("pt-PT") : "não definida"}</p><p className="text-xs text-muted-foreground mt-1">Custo previsto: {fmt(producao.custoLote)} € · Solicitado por utilizador #{aprovacao.solicitadoPor}</p></div><div className="flex gap-2"><Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10" disabled={decidirProducao.isPending} onClick={() => rejeitar("producao", producao.id)}><X className="w-4 h-4 mr-1" />Rejeitar</Button><Button className="bg-primary text-primary-foreground" disabled={decidirProducao.isPending} onClick={() => decidirProducao.mutate({ producaoId: producao.id, aprovar: true })}><Check className="w-4 h-4 mr-1" />Aprovar</Button></div></CardContent></Card>)}</section>}{(inventarios.data?.length ?? 0) > 0 && <section className="space-y-3"><h2 className="text-sm uppercase tracking-wide text-muted-foreground">Inventários críticos</h2>{inventarios.data?.map(({ aprovacao, inventario }) => <Card key={`i-${aprovacao.id}`} className="bg-card border-danger/30"><CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4"><div className="flex-1"><div className="flex items-center gap-2"><p className="font-medium text-gold">{inventario.nome ?? `Inventário #${inventario.id}`}</p><Badge className="bg-danger/20 text-danger">Desvio crítico</Badge></div><p className="text-sm text-muted-foreground mt-1">Zona: {inventario.zona ?? "Todas"} · Solicitado por utilizador #{aprovacao.solicitadoPor}</p><p className="text-xs text-muted-foreground mt-1">Ao aprovar, os ajustes serão gravados uma única vez no livro de movimentos.</p></div><div className="flex gap-2"><Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10" disabled={decidirInventario.isPending} onClick={() => rejeitar("inventario", inventario.id)}><X className="w-4 h-4 mr-1" />Rejeitar</Button><Button className="bg-primary text-primary-foreground" disabled={decidirInventario.isPending} onClick={() => decidirInventario.mutate({ inventarioId: inventario.id, aprovar: true })}><Check className="w-4 h-4 mr-1" />Aprovar</Button></div></CardContent></Card>)}</section>}</div>}</div>;
}
