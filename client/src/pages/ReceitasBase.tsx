import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, ChefHat, Play, Trash2 } from "lucide-react";
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
    onSuccess: (dados) => { toast.success(`Produção registada — Custo: ${fmt(dados.custoLote, 2)} € · Desvio: ${fmt(dados.desvioPct, 1)}%`); utils.artigos.listar.invalidate(); onClose(); },
    onError: (erro) => toast.error(erro.message),
  });
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Registar produção de <strong>{receitaNome}</strong></p><div><label className="text-xs text-muted-foreground mb-1 block">Quantidade produzida (unidade base)</label><Input value={qtd} onChange={(e) => setQtd(e.target.value)} type="number" step="0.001" className="bg-input border-border" /></div><Button className="w-full bg-primary text-primary-foreground" disabled={produzir.isPending} onClick={() => produzir.mutate({ receitaId, quantidadeProduzida: parseFloat(qtd) })}>{produzir.isPending ? "A produzir…" : "Registar Produção"}</Button></div>;
}

type LinhaComponente = { componenteId: string; quantidade: string };

function NovaReceitaDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: artigos } = trpc.artigos.listar.useQuery();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidadeBase, setUnidadeBase] = useState("g");
  const [rendimento, setRendimento] = useState("");
  const [validade, setValidade] = useState("");
  const [linhas, setLinhas] = useState<LinhaComponente[]>([{ componenteId: "", quantidade: "" }]);
  const criar = trpc.receitas.criar.useMutation({
    onSuccess: () => { toast.success("Receita base criada com sucesso."); utils.receitas.listar.invalidate(); utils.artigos.listar.invalidate(); onClose(); },
    onError: (erro) => toast.error(erro.message),
  });
  const opcoes = (artigos ?? []).filter((artigo) => artigo.ativo);
  const categorias = Array.from(new Set(opcoes.map((artigo) => artigo.categoria).filter((categoria): categoria is string => Boolean(categoria))));
  const alterarLinha = (indice: number, patch: Partial<LinhaComponente>) => setLinhas((atuais) => atuais.map((linha, i) => i === indice ? { ...linha, ...patch } : linha));
  const submeter = () => {
    if (!nome.trim() || Number(rendimento) <= 0) return toast.error("Indica o nome e um rendimento superior a zero.");
    const componentes = linhas.filter((linha) => linha.componenteId && Number(linha.quantidade) > 0);
    if (!componentes.length) return toast.error("Adiciona pelo menos um componente com quantidade.");
    criar.mutate({ nome: nome.trim(), categoria: categoria || undefined, unidadeBase, rendimentoEsperado: Number(rendimento), validadeProducaoDias: validade ? Number(validade) : undefined, componentes: componentes.map((linha, ordem) => ({ componenteId: Number(linha.componenteId), quantidade: Number(linha.quantidade), unidade: opcoes.find((artigo) => artigo.id === Number(linha.componenteId))?.unidadeBase ?? "g", ordem })) });
  };
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Define o rendimento final e os componentes da nova receita base.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="sm:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nome <span className="text-danger">*</span></label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Molho tare" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Categoria</label><select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="">— seleccionar —</option>{categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="text-xs text-muted-foreground mb-1 block">Unidade de produção</label><select value={unidadeBase} onChange={(e) => setUnidadeBase(e.target.value)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="g">g</option><option value="ml">ml</option><option value="un">un</option></select></div><div><label className="text-xs text-muted-foreground mb-1 block">Rendimento <span className="text-danger">*</span></label><Input type="number" min="0.1" step="0.1" value={rendimento} onChange={(e) => setRendimento(e.target.value)} placeholder="0" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Validade (dias)</label><Input type="number" min="0" step="1" value={validade} onChange={(e) => setValidade(e.target.value)} placeholder="Opcional" className="bg-input border-border" /></div></div><div className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wide">Componentes</p><Button type="button" size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => setLinhas((atuais) => [...atuais, { componenteId: "", quantidade: "" }])}><Plus className="w-3 h-3 mr-1" />Adicionar</Button></div>{linhas.map((linha, indice) => <div key={indice} className="flex gap-2"><select value={linha.componenteId} onChange={(e) => alterarLinha(indice, { componenteId: e.target.value })} className="min-w-0 flex-1 h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="">— componente —</option>{opcoes.map((artigo) => <option key={artigo.id} value={artigo.id}>{artigo.nome} ({artigo.unidadeBase})</option>)}</select><Input type="number" min="0.001" step="0.001" value={linha.quantidade} onChange={(e) => alterarLinha(indice, { quantidade: e.target.value })} placeholder="Qtd." className="w-24 bg-input border-border" /><Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-danger" disabled={linhas.length === 1} onClick={() => setLinhas((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="w-4 h-4" /></Button></div>)}</div><div className="flex justify-end gap-2 pt-2"><Button variant="outline" className="border-border" onClick={onClose}>Cancelar</Button><Button className="bg-primary text-primary-foreground" disabled={criar.isPending} onClick={submeter}>{criar.isPending ? "A criar…" : "Criar Receita"}</Button></div></div>;
}

export default function ReceitasBase() {
  const [producaoId, setProducaoId] = useState<{ id: number; nome: string } | null>(null);
  const [novaReceita, setNovaReceita] = useState(false);
  const { data: receitas, isLoading } = trpc.receitas.listar.useQuery();
  return <div className="space-y-5 animate-in"><div className="flex items-center justify-between"><div><h1 className="font-display text-3xl text-gold">Receitas Base</h1><p className="text-muted-foreground text-sm mt-0.5">{receitas?.length ?? 0} receitas</p></div><Button className="bg-primary text-primary-foreground gap-2" onClick={() => setNovaReceita(true)}><Plus className="w-4 h-4" /> Nova Receita</Button></div><Dialog open={novaReceita} onOpenChange={setNovaReceita}><DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Nova Receita Base</DialogTitle></DialogHeader><NovaReceitaDialog onClose={() => setNovaReceita(false)} /></DialogContent></Dialog><Dialog open={!!producaoId} onOpenChange={() => setProducaoId(null)}><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Registar Produção</DialogTitle></DialogHeader>{producaoId && <ProducaoDialog receitaId={producaoId.id} receitaNome={producaoId.nome} onClose={() => setProducaoId(null)} />}</DialogContent></Dialog>{isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-card rounded animate-pulse" />)}</div> : (receitas?.length ?? 0) === 0 ? <div className="text-center py-16 text-muted-foreground"><ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Ainda não há receitas base. Cria a primeira a partir dos ingredientes que já tens.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{receitas!.map((receita) => <Card key={receita.id} className="bg-card border-border hover:border-primary/30 transition-colors"><CardContent className="p-4 space-y-3"><div className="flex items-start justify-between"><Link href={`/receitas/${receita.id}`}><h3 className="font-medium text-gold hover:underline cursor-pointer">{receita.nome}</h3></Link><Button size="sm" variant="outline" className="border-border gap-1 h-7 text-xs ml-2" onClick={() => setProducaoId({ id: receita.id, nome: receita.nome })}><Play className="w-3 h-3" /> Produzir</Button></div><div className="text-xs text-muted-foreground space-y-1"><p>Rendimento: {fmt(parseFloat(receita.rendimentoEsperado ?? "0"), 0)} {receita.unidadeBase}</p><p>Validade: {receita.validadeProducaoDias ?? "—"} dias</p><p>Custo médio: {fmt(parseFloat(receita.custoMedioPonderado ?? "0") * 1000, 4)} €/kg</p></div></CardContent></Card>)}</div>}</div>;
}
