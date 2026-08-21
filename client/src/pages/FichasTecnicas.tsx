import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, BookOpen, Trash2, Calculator, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SeletorComponentePesquisavel } from "@/components/SeletorComponentePesquisavel";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { correspondePesquisaAproximada } from "@/lib/pesquisaAproximada";
import { toast } from "sonner";

const FAMILIAS = ["Cozinha Quente", "Sushi", "Pastelaria"] as const;
type Familia = (typeof FAMILIAS)[number];
type LinhaComponente = { componenteId: string; quantidade: string };

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function FormFicha({ fichaId, onClose }: { fichaId?: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: artigos } = trpc.artigos.listar.useQuery();
  const { data: fichas } = trpc.fichas.listar.useQuery();
  const { data: detalhe } = trpc.fichas.obter.useQuery({ id: fichaId ?? 0 }, { enabled: Boolean(fichaId) });
  const [nome, setNome] = useState("");
  const [secaoMenu, setSecaoMenu] = useState("");
  const [familia, setFamilia] = useState<Familia>("Cozinha Quente");
  const [precoVenda, setPrecoVenda] = useState("");
  const [linhas, setLinhas] = useState<LinhaComponente[]>([{ componenteId: "", quantidade: "" }]);
  const [fichaFonteId, setFichaFonteId] = useState<number | null>(null);
  const { data: fichaFonte } = trpc.fichas.obter.useQuery({ id: fichaFonteId ?? 0 }, { enabled: fichaFonteId !== null });
  const criar = trpc.fichas.criar.useMutation({ onSuccess: () => concluir("Ficha técnica criada com sucesso."), onError: (erro) => toast.error(erro.message) });
  const atualizar = trpc.fichas.atualizar.useMutation({ onSuccess: () => concluir("Ficha técnica atualizada."), onError: (erro) => toast.error(erro.message) });
  const concluir = (mensagem: string) => { toast.success(mensagem); utils.fichas.listar.invalidate(); if (fichaId) utils.fichas.obter.invalidate({ id: fichaId }); onClose(); };
  const opcoes = (artigos ?? []).filter((artigo) => artigo.ativo);
  const opcoesPesquisa = [...opcoes, ...(fichas ?? []).filter((ficha) => ficha.ativo && ficha.id !== fichaId).map((ficha) => ({ id: ficha.id, nome: ficha.nome, unidadeBase: "ficha", tipo: "ficha_tecnica" as const }))];

  useEffect(() => {
    if (!detalhe || !fichaId) return;
    setNome(detalhe.nome);
    setSecaoMenu(detalhe.secaoMenu ?? "");
    setFamilia((FAMILIAS.includes(detalhe.familia as Familia) ? detalhe.familia : "Cozinha Quente") as Familia);
    setPrecoVenda(detalhe.precoVenda ?? "");
    setLinhas(detalhe.componentes.length ? detalhe.componentes.map((linha) => ({ componenteId: String(linha.componenteId), quantidade: String(linha.quantidade) })) : [{ componenteId: "", quantidade: "" }]);
  }, [detalhe, fichaId]);

  useEffect(() => {
    if (!fichaFonte || fichaFonteId === null) return;
    const importados = fichaFonte.componentes.map((linha) => ({ componenteId: String(linha.componenteId), quantidade: String(linha.quantidade) }));
    if (!importados.length) toast.error("A ficha selecionada não tem componentes para copiar.");
    else { setLinhas((atuais) => [...atuais.filter((linha) => linha.componenteId || linha.quantidade), ...importados]); toast.success(`${importados.length} componentes copiados de ${fichaFonte.nome}.`); }
    setFichaFonteId(null);
  }, [fichaFonte, fichaFonteId]);

  const alterarLinha = (indice: number, patch: Partial<LinhaComponente>) => setLinhas((atuais) => atuais.map((linha, i) => i === indice ? { ...linha, ...patch } : linha));
  const custoEstimado = useMemo(() => linhas.reduce((total, linha) => total + Number(linha.quantidade || 0) * Number(opcoes.find((artigo) => artigo.id === Number(linha.componenteId))?.custoMedioPonderado ?? 0), 0), [linhas, opcoes]);
  const preco = Number(precoVenda || 0);
  const foodCost = preco > 0 ? (custoEstimado / preco) * 100 : null;
  const submeter = () => {
    if (!nome.trim()) return toast.error("Indica o nome da ficha técnica.");
    const componentes = linhas.filter((linha) => linha.componenteId && Number(linha.quantidade) > 0).map((linha, ordem) => ({ componenteId: Number(linha.componenteId), quantidade: Number(linha.quantidade), unidade: opcoes.find((artigo) => artigo.id === Number(linha.componenteId))?.unidadeBase ?? "g", ordem }));
    if (!componentes.length) return toast.error("Adiciona pelo menos um componente com quantidade.");
    const dados = { nome: nome.trim(), familia, secaoMenu: secaoMenu || undefined, precoVenda: preco || undefined, componentes };
    if (fichaId) atualizar.mutate({ id: fichaId, ...dados }); else criar.mutate(dados);
  };
  const aGuardar = criar.isPending || atualizar.isPending;
  return <div className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="sm:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nome <span className="text-danger">*</span></label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nigiri de salmão" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Família <span className="text-danger">*</span></label><select value={familia} onChange={(e) => setFamilia(e.target.value as Familia)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm">{FAMILIAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="text-xs text-muted-foreground mb-1 block">Secção de menu</label><Input value={secaoMenu} onChange={(e) => setSecaoMenu(e.target.value)} placeholder="Ex.: SUSHI" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Preço de venda (€)</label><Input type="number" min="0" step="0.01" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} placeholder="0,00" className="bg-input border-border" /></div></div><Card className="bg-primary/5 border-primary/20"><CardContent className="p-3 flex items-center gap-3"><Calculator className="w-5 h-5 text-gold" /><div className="flex-1"><p className="text-xs text-muted-foreground">Simulador de preço</p><p className="font-medium">Custo estimado: <span className="text-gold">{fmt(custoEstimado, 2)} €</span></p></div><div className="text-right"><p className="text-xs text-muted-foreground">Food Cost</p><p className={cn("font-medium", foodCost != null && foodCost > 30 ? "text-danger" : "text-success")}>{foodCost == null ? "—" : `${fmt(foodCost, 1)}%`}</p></div></CardContent></Card><div className="space-y-2"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase tracking-wide">Componentes</p><p className="text-[11px] text-muted-foreground">Pesquise ingredientes, receitas base ou fichas técnicas pelo nome. Ao selecionar uma ficha, os seus componentes são copiados.</p></div><Button type="button" size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => setLinhas((atuais) => [...atuais, { componenteId: "", quantidade: "" }])}><Plus className="w-3 h-3 mr-1" />Adicionar</Button></div>{linhas.map((linha, indice) => <div key={indice} className="flex gap-2"><SeletorComponentePesquisavel value={linha.componenteId} onChange={(componenteId) => alterarLinha(indice, { componenteId })} onSelecionarFicha={setFichaFonteId} opcoes={opcoesPesquisa} /><Input type="number" min="0.001" step="0.001" value={linha.quantidade} onChange={(e) => alterarLinha(indice, { quantidade: e.target.value })} placeholder="Qtd." className="w-24 bg-input border-border" /><Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-danger" disabled={linhas.length === 1} onClick={() => setLinhas((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="w-4 h-4" /></Button></div>)}</div><div className="flex justify-end gap-2 pt-2"><Button variant="outline" className="border-border" onClick={onClose}>Cancelar</Button><Button className="bg-primary text-primary-foreground" disabled={aGuardar} onClick={submeter}>{aGuardar ? "A guardar…" : fichaId ? "Guardar Alterações" : "Criar Ficha"}</Button></div></div>;
}

export default function FichasTecnicas() {
  const [novaFicha, setNovaFicha] = useState(false);
  const [editarId, setEditarId] = useState<number | null>(null);
  const [eliminarId, setEliminarId] = useState<number | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [familiaFiltro, setFamiliaFiltro] = useState("todas");
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: fichas, isLoading } = trpc.fichas.listar.useQuery();
  const eliminar = trpc.fichas.eliminar.useMutation({
    onSuccess: (resultado) => {
      toast.success(resultado.mensagem);
      utils.fichas.listar.invalidate();
      setEliminarId(null);
    },
    onError: (erro) => toast.error(erro.message),
  });
  const fichasFiltradas = useMemo(() => (fichas ?? []).filter((ficha) => correspondePesquisaAproximada(ficha.nome, pesquisa) && (familiaFiltro === "todas" || ficha.familia === familiaFiltro)), [fichas, pesquisa, familiaFiltro]);
  const fichaAEliminar = (fichas ?? []).find((ficha) => ficha.id === eliminarId);
  const podeEliminar = ["admin", "head_chef"].includes(user?.role ?? "");
  useEffect(() => {
    const editar = Number(new URLSearchParams(window.location.search).get("editar"));
    if (Number.isInteger(editar) && editar > 0) setEditarId(editar);
  }, []);
  return <div className="space-y-5 animate-in"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-display text-3xl text-gold">Fichas Técnicas</h1><p className="text-muted-foreground text-sm mt-0.5">{fichasFiltradas.length} de {fichas?.length ?? 0} fichas activas</p></div><Button className="bg-primary text-primary-foreground gap-2" onClick={() => setNovaFicha(true)}><Plus className="w-4 h-4" /> Nova Ficha</Button></div><div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} placeholder="Pesquisar por nome, incluindo aproximações…" className="pl-9 bg-input border-border" /></div><select value={familiaFiltro} onChange={(e) => setFamiliaFiltro(e.target.value)} className="h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="todas">Todas as famílias</option>{FAMILIAS.map((familia) => <option key={familia} value={familia}>{familia}</option>)}</select></div><Dialog open={novaFicha} onOpenChange={setNovaFicha}><DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Nova Ficha Técnica</DialogTitle></DialogHeader><FormFicha onClose={() => setNovaFicha(false)} /></DialogContent></Dialog><Dialog open={editarId !== null} onOpenChange={(aberto) => !aberto && setEditarId(null)}><DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-xl text-gold">Editar Ficha Técnica</DialogTitle></DialogHeader>{editarId && <FormFicha fichaId={editarId} onClose={() => setEditarId(null)} />}</DialogContent></Dialog><AlertDialog open={eliminarId !== null} onOpenChange={(aberto) => !aberto && setEliminarId(null)}><AlertDialogContent className="bg-card border-border"><AlertDialogHeader><AlertDialogTitle>Excluir ficha técnica?</AlertDialogTitle><AlertDialogDescription>A ficha <strong>{fichaAEliminar?.nome ?? "selecionada"}</strong> será desativada e deixará de aparecer na lista ativa. A operação é bloqueada se existirem vendas ou mapeamentos POS associados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={eliminar.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={eliminar.isPending} onClick={(evento) => { evento.preventDefault(); if (eliminarId) eliminar.mutate({ id: eliminarId }); }} className="bg-danger text-danger-foreground hover:bg-danger/90">{eliminar.isPending ? "A excluir…" : "Excluir ficha"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{isLoading ? <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div> : fichasFiltradas.length === 0 ? <div className="text-center py-16 text-muted-foreground"><BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Não foram encontradas fichas para esta pesquisa.</p></div> : <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm tabular-nums"><thead><tr className="border-b border-border bg-secondary/50">{["Prato", "Família", "Custo/Dose", "Preço Venda", "Food Cost", "Margem", "Estado", ""].map((cabecalho) => <th key={cabecalho || "acoes"} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">{cabecalho}</th>)}</tr></thead><tbody>{fichasFiltradas.map((ficha) => { const custo = ficha.custoCalculado ?? 0; const preco = parseFloat(ficha.precoVenda ?? "0"); const margem = preco - custo; const foodCost = ficha.foodCostPct ?? null; const alvo = parseFloat(ficha.foodCostAlvo ?? "30"); return <tr key={ficha.id} className="border-b border-border hover:bg-secondary/30"><td className="px-4 py-3"><Link href={`/fichas/${ficha.id}`}><span className="hover:text-gold cursor-pointer font-medium transition-colors">{ficha.nome}</span></Link></td><td className="px-4 py-3"><Badge variant="outline" className="border-gold/30 text-gold text-xs">{ficha.familia ?? "Sem família"}</Badge></td><td className="px-4 py-3 font-mono">{fmt(custo, 2)} €</td><td className="px-4 py-3 font-mono text-gold">{fmt(preco)} €</td><td className={cn("px-4 py-3 font-mono font-medium", foodCost != null && foodCost > alvo ? "text-danger" : foodCost != null ? "text-success" : "")}>{foodCost != null ? `${fmt(foodCost, 1)}%` : "—"}</td><td className={cn("px-4 py-3 font-mono", margem > 0 ? "text-success" : "text-danger")}>{fmt(margem)} €</td><td className="px-4 py-3"><Badge className={`text-xs ${ficha.ativo ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}>{ficha.ativo ? "Activa" : "Inactiva"}</Badge></td><td className="px-4 py-3 whitespace-nowrap"><Button variant="ghost" size="icon" title="Editar ficha técnica" onClick={() => setEditarId(ficha.id)} className="text-muted-foreground hover:text-gold"><Pencil className="w-4 h-4" /></Button>{podeEliminar && <Button variant="ghost" size="icon" title="Excluir ficha técnica" onClick={() => setEliminarId(ficha.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="w-4 h-4" /></Button>}</td></tr>; })}</tbody></table></div>}</div>;
}
