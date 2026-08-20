import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, ChefHat, Play, Trash2, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SeletorComponentePesquisavel } from "@/components/SeletorComponentePesquisavel";
import { correspondePesquisaAproximada } from "@/lib/pesquisaAproximada";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const FAMILIAS = ["Cozinha Quente", "Sushi", "Pastelaria"] as const;
type Familia = (typeof FAMILIAS)[number];
type LinhaComponente = { componenteId: string; quantidade: string };

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function ProducaoDialog({ receitaId, receitaNome, onClose }: { receitaId: number; receitaNome: string; onClose: () => void }) {
  const [qtd, setQtd] = useState("1");
  const [metodoConservacao, setMetodoConservacao] = useState<"vacuo" | "refrigerado" | "congelado" | "ambiente">("refrigerado");
  const [notas, setNotas] = useState("");
  const [idCliente, setIdCliente] = useState(() => crypto.randomUUID());
  const utils = trpc.useUtils();
  const produzir = trpc.receitas.registarProducao.useMutation({
    onSuccess: (dados) => { toast.success(dados.idempotente ? "Pedido de produção já registado." : `Pedido enviado para aprovação — custo previsto: ${fmt(dados.custoLote, 2)} €.`); utils.receitas.historicoProducoes.invalidate({ receitaId }); setIdCliente(crypto.randomUUID()); onClose(); },
    onError: (erro) => toast.error(erro.message),
  });
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">A produção de <strong>{receitaNome}</strong> cria um pedido rastreável e requer aprovação de outro gestor antes de movimentar stock.</p><div><label className="text-xs text-muted-foreground mb-1 block">Quantidade produzida (unidade base)</label><Input value={qtd} onChange={(e) => setQtd(e.target.value)} type="number" min="0.001" step="0.001" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Conservação do lote</label><select value={metodoConservacao} onChange={(e) => setMetodoConservacao(e.target.value as typeof metodoConservacao)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="refrigerado">Refrigerado</option><option value="congelado">Congelado</option><option value="vacuo">Vácuo</option><option value="ambiente">Ambiente</option></select></div><div><label className="text-xs text-muted-foreground mb-1 block">Notas para aprovação</label><Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" className="bg-input border-border" /></div><Button className="w-full bg-primary text-primary-foreground" disabled={produzir.isPending || Number(qtd) <= 0} onClick={() => produzir.mutate({ receitaId, quantidadeProduzida: parseFloat(qtd), metodoConservacao, notas: notas || undefined, idCliente })}>{produzir.isPending ? "A enviar…" : "Enviar para aprovação"}</Button></div>;
}

function FormReceita({ receitaId, onClose }: { receitaId?: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: artigos } = trpc.artigos.listar.useQuery();
  const { data: fichas } = trpc.fichas.listar.useQuery();
  const { data: detalhe } = trpc.receitas.obter.useQuery({ id: receitaId ?? 0 }, { enabled: Boolean(receitaId) });
  const [nome, setNome] = useState("");
  const [familia, setFamilia] = useState<Familia>("Cozinha Quente");
  const [categoria, setCategoria] = useState("");
  const [unidadeBase, setUnidadeBase] = useState("g");
  const [rendimento, setRendimento] = useState("");
  const [validade, setValidade] = useState("");
  const [linhas, setLinhas] = useState<LinhaComponente[]>([{ componenteId: "", quantidade: "" }]);
  const [fichaFonteId, setFichaFonteId] = useState<number | null>(null);
  const { data: fichaFonte } = trpc.fichas.obter.useQuery({ id: fichaFonteId ?? 0 }, { enabled: fichaFonteId !== null });
  const criar = trpc.receitas.criar.useMutation({ onSuccess: () => concluir("Receita base criada com sucesso."), onError: (erro) => toast.error(erro.message) });
  const atualizar = trpc.receitas.atualizar.useMutation({ onSuccess: () => concluir("Receita base atualizada."), onError: (erro) => toast.error(erro.message) });
  const concluir = (mensagem: string) => { toast.success(mensagem); utils.receitas.listar.invalidate(); utils.artigos.listar.invalidate(); if (receitaId) utils.receitas.obter.invalidate({ id: receitaId }); onClose(); };
  const opcoes = (artigos ?? []).filter((artigo) => artigo.ativo && artigo.id !== receitaId);
  const opcoesPesquisa = [...opcoes, ...(fichas ?? []).filter((ficha) => ficha.ativo).map((ficha) => ({ id: ficha.id, nome: ficha.nome, unidadeBase: "ficha", tipo: "ficha_tecnica" as const }))];
  const categorias = Array.from(new Set(opcoes.map((artigo) => artigo.categoria).filter((categoria): categoria is string => Boolean(categoria))));
  useEffect(() => {
    if (!detalhe || !receitaId) return;
    setNome(detalhe.nome); setFamilia((FAMILIAS.includes(detalhe.familia as Familia) ? detalhe.familia : "Cozinha Quente") as Familia); setCategoria(detalhe.categoria ?? ""); setUnidadeBase(detalhe.unidadeBase); setRendimento(detalhe.rendimentoEsperado ?? ""); setValidade(detalhe.validadeProducaoDias == null ? "" : String(detalhe.validadeProducaoDias));
    setLinhas(detalhe.componentes.length ? detalhe.componentes.map((linha) => ({ componenteId: String(linha.componenteId), quantidade: String(linha.quantidade) })) : [{ componenteId: "", quantidade: "" }]);
  }, [detalhe, receitaId]);
  useEffect(() => {
    if (!fichaFonte || fichaFonteId === null) return;
    const importados = fichaFonte.componentes.map((linha) => ({ componenteId: String(linha.componenteId), quantidade: String(linha.quantidade) }));
    if (!importados.length) toast.error("A ficha selecionada não tem componentes para copiar.");
    else { setLinhas((atuais) => [...atuais.filter((linha) => linha.componenteId || linha.quantidade), ...importados]); toast.success(`${importados.length} componentes copiados de ${fichaFonte.nome}.`); }
    setFichaFonteId(null);
  }, [fichaFonte, fichaFonteId]);
  const alterarLinha = (indice: number, patch: Partial<LinhaComponente>) => setLinhas((atuais) => atuais.map((linha, i) => i === indice ? { ...linha, ...patch } : linha));
  const submeter = () => {
    if (!nome.trim() || (!receitaId && Number(rendimento) <= 0)) return toast.error(receitaId ? "Indica o nome da receita." : "Indica o nome e um rendimento superior a zero.");
    const componentes = linhas.filter((linha) => linha.componenteId && Number(linha.quantidade) > 0).map((linha, ordem) => ({ componenteId: Number(linha.componenteId), quantidade: Number(linha.quantidade), unidade: opcoes.find((artigo) => artigo.id === Number(linha.componenteId))?.unidadeBase ?? "g", ordem }));
    if (!componentes.length) return toast.error("Adiciona pelo menos um componente com quantidade.");
    if (receitaId) atualizar.mutate({ id: receitaId, nome: nome.trim(), familia, unidadeBase, rendimentoEsperado: Number(rendimento || 0), validadeProducaoDias: validade ? Number(validade) : null, componentes });
    else criar.mutate({ nome: nome.trim(), categoria: categoria || undefined, familia, unidadeBase, rendimentoEsperado: Number(rendimento), validadeProducaoDias: validade ? Number(validade) : undefined, componentes });
  };
  const aGuardar = criar.isPending || atualizar.isPending;
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Classifica a receita na respetiva família e mantém os seus componentes atualizados.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="sm:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nome <span className="text-danger">*</span></label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Molho tare" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Família <span className="text-danger">*</span></label><select value={familia} onChange={(e) => setFamilia(e.target.value as Familia)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm">{FAMILIAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="text-xs text-muted-foreground mb-1 block">Categoria</label><select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="">— seleccionar —</option>{categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="text-xs text-muted-foreground mb-1 block">Unidade de produção</label><select value={unidadeBase} onChange={(e) => setUnidadeBase(e.target.value)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="g">g</option><option value="ml">ml</option><option value="un">un</option></select></div><div><label className="text-xs text-muted-foreground mb-1 block">Rendimento {receitaId ? "(preencher manualmente)" : "*"}</label><Input type="number" min="0" step="0.1" value={rendimento} onChange={(e) => setRendimento(e.target.value)} placeholder="0" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Validade (dias)</label><Input type="number" min="0" step="1" value={validade} onChange={(e) => setValidade(e.target.value)} placeholder="Opcional" className="bg-input border-border" /></div></div><div className="space-y-2"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase tracking-wide">Componentes</p><p className="text-[11px] text-muted-foreground">Pesquise ingredientes, receitas base ou fichas técnicas pelo nome. Ao selecionar uma ficha, os seus componentes são copiados.</p></div><Button type="button" size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => setLinhas((atuais) => [...atuais, { componenteId: "", quantidade: "" }])}><Plus className="w-3 h-3 mr-1" />Adicionar</Button></div>{linhas.map((linha, indice) => <div key={indice} className="flex gap-2"><SeletorComponentePesquisavel value={linha.componenteId} onChange={(componenteId) => alterarLinha(indice, { componenteId })} onSelecionarFicha={setFichaFonteId} opcoes={opcoesPesquisa} /><Input type="number" min="0.001" step="0.001" value={linha.quantidade} onChange={(e) => alterarLinha(indice, { quantidade: e.target.value })} placeholder="Qtd." className="w-24 bg-input border-border" /><Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-danger" disabled={linhas.length === 1} onClick={() => setLinhas((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="w-4 h-4" /></Button></div>)}</div><div className="flex justify-end gap-2 pt-2"><Button variant="outline" className="border-border" onClick={onClose}>Cancelar</Button><Button className="bg-primary text-primary-foreground" disabled={aGuardar} onClick={submeter}>{aGuardar ? "A guardar…" : receitaId ? "Guardar Alterações" : "Criar Receita"}</Button></div></div>;
}

export default function ReceitasBase() {
  const [producaoId, setProducaoId] = useState<{ id: number; nome: string } | null>(null);
  const [novaReceita, setNovaReceita] = useState(false);
  const [editarId, setEditarId] = useState<number | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [familiaFiltro, setFamiliaFiltro] = useState("todas");
  const { data: receitas, isLoading } = trpc.receitas.listar.useQuery();
  const receitasFiltradas = useMemo(() => (receitas ?? []).filter((receita) => correspondePesquisaAproximada(receita.nome, pesquisa) && (familiaFiltro === "todas" || receita.familia === familiaFiltro)), [receitas, pesquisa, familiaFiltro]);
  useEffect(() => {
    const editar = Number(new URLSearchParams(window.location.search).get("editar"));
    if (Number.isInteger(editar) && editar > 0) setEditarId(editar);
  }, []);
  return <div className="space-y-5 animate-in"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-display text-3xl text-gold">Receitas Base</h1><p className="text-muted-foreground text-sm mt-0.5">{receitasFiltradas.length} de {receitas?.length ?? 0} receitas</p></div><Button className="bg-primary text-primary-foreground gap-2" onClick={() => setNovaReceita(true)}><Plus className="w-4 h-4" /> Nova Receita</Button></div><div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} placeholder="Pesquisar por nome, incluindo aproximações…" className="pl-9 bg-input border-border" /></div><select value={familiaFiltro} onChange={(e) => setFamiliaFiltro(e.target.value)} className="h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="todas">Todas as famílias</option>{FAMILIAS.map((familia) => <option key={familia} value={familia}>{familia}</option>)}</select></div><Dialog open={novaReceita} onOpenChange={setNovaReceita}><DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Nova Receita Base</DialogTitle></DialogHeader><FormReceita onClose={() => setNovaReceita(false)} /></DialogContent></Dialog><Dialog open={editarId !== null} onOpenChange={(aberto) => !aberto && setEditarId(null)}><DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Editar Receita Base</DialogTitle></DialogHeader>{editarId && <FormReceita receitaId={editarId} onClose={() => setEditarId(null)} />}</DialogContent></Dialog><Dialog open={!!producaoId} onOpenChange={() => setProducaoId(null)}><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Registar Produção</DialogTitle></DialogHeader>{producaoId && <ProducaoDialog receitaId={producaoId.id} receitaNome={producaoId.nome} onClose={() => setProducaoId(null)} />}</DialogContent></Dialog>{isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-card rounded animate-pulse" />)}</div> : receitasFiltradas.length === 0 ? <div className="text-center py-16 text-muted-foreground"><ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Não foram encontradas receitas para esta pesquisa.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{receitasFiltradas.map((receita) => <Card key={receita.id} className="bg-card border-border hover:border-primary/30 transition-colors"><CardContent className="p-4 space-y-3"><div className="flex items-start justify-between gap-2"><Link href={`/receitas/${receita.id}`}><h3 className="font-medium text-gold hover:underline cursor-pointer">{receita.nome}</h3></Link><Button size="icon" variant="ghost" title="Editar receita" className="w-7 h-7 text-muted-foreground hover:text-gold" onClick={() => setEditarId(receita.id)}><Pencil className="w-4 h-4" /></Button></div><Badge variant="outline" className="border-gold/30 text-gold text-xs">{receita.familia ?? "Sem família"}</Badge><div className="text-xs text-muted-foreground space-y-1"><p>Rendimento: {fmt(parseFloat(receita.rendimentoEsperado ?? "0"), 0)} {receita.unidadeBase}</p><p>Validade: {receita.validadeProducaoDias ?? "—"} dias</p><p>Custo médio: {fmt(parseFloat(receita.custoMedioPonderado ?? "0") * 1000, 4)} €/kg</p></div><Button size="sm" variant="outline" className="border-border gap-1 h-7 text-xs" onClick={() => setProducaoId({ id: receita.id, nome: receita.nome })}><Play className="w-3 h-3" /> Produzir</Button></CardContent></Card>)}</div>}</div>;
}
