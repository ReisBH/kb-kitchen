import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, Clock3, FileImage, Loader2, ReceiptText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type Confianca = "alta" | "media" | "baixa";
type LinhaRevisao = {
  descricao: string;
  artigoId?: number;
  artigoNome?: string;
  quantidade: number;
  unidade: string;
  pesoOuUnidade: string;
  precoPorUnidade: number;
  taxaIva: number;
  valorIva: number;
  valorLinha: number;
  confianca: Confianca;
  incluir: boolean;
};

type FichaConferencia = {
  fornecedor: string;
  nif: string;
  numero: string;
  dataEmissao: string;
  dataVencimento: string;
  dataVencimentoCalculada: boolean;
  condicoesPagamento: string;
  valorTotal: number;
};

const FICHA_VAZIA: FichaConferencia = {
  fornecedor: "", nif: "", numero: "", dataEmissao: "", dataVencimento: "", dataVencimentoCalculada: false, condicoesPagamento: "", valorTotal: 0,
};

const moeda = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

function dataApresentacao(valor: Date | string | null | undefined) {
  if (!valor) return "Sem vencimento";
  const data = valor instanceof Date ? valor : new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? "Sem vencimento" : data.toLocaleDateString("pt-PT");
}

function classeEstado(estado: string) {
  if (estado === "atrasado") return "bg-danger/20 text-danger border-danger/30";
  if (estado === "paga") return "bg-success/20 text-success border-success/30";
  return "bg-warning/20 text-warning border-warning/30";
}

export default function OcrFaturas() {
  const { user } = useAuth();
  const [docId, setDocId] = useState<number | null>(null);
  const [ficha, setFicha] = useState<FichaConferencia>(FICHA_VAZIA);
  const [fornecedorId, setFornecedorId] = useState<number | undefined>();
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const uploadImagem = trpc.upload.uploadImagem.useMutation();
  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: "ingrediente" });
  const { data: fornecedores } = trpc.fornecedores.listar.useQuery();
  const { data: contasPagar, isLoading: aCarregarContas } = trpc.ocr.listarContasPagar.useQuery();

  const processar = trpc.ocr.processarFatura.useMutation({
    onSuccess: (resultado) => {
      const dados = resultado.dadosExtraidos;
      setDocId(resultado.docId);
      setFornecedorId(dados.fornecedorEmparelhado?.id);
      setFicha({
        fornecedor: dados.fornecedor ?? "", nif: dados.nif ?? "", numero: dados.numero ?? "",
        dataEmissao: dados.dataEmissao ?? "", dataVencimento: dados.dataVencimento ?? "",
        dataVencimentoCalculada: Boolean(dados.dataVencimentoCalculada), condicoesPagamento: dados.condicoesPagamento ?? "", valorTotal: Number(dados.valorTotal ?? 0),
      });
      setLinhas((dados.linhas ?? []).map((linha: any) => ({
        descricao: linha.descricao ?? "", artigoId: linha.artigoEmparelhado?.id, artigoNome: linha.artigoEmparelhado?.nome,
        quantidade: Number(linha.quantidade ?? 0), unidade: linha.unidade ?? "un", pesoOuUnidade: linha.pesoOuUnidade ?? linha.unidade ?? "",
        precoPorUnidade: Number(linha.precoPorUnidade ?? 0), taxaIva: Number(linha.taxaIva ?? 0), valorIva: Number(linha.valorIva ?? 0),
        valorLinha: Number(linha.valorLinha ?? 0), confianca: linha.confianca === "alta" || linha.confianca === "baixa" ? linha.confianca : "media", incluir: Boolean(linha.artigoEmparelhado),
      })));
      setUploading(false);
      toast.success("Fatura lida pela Gemini. Confirma ou corrige todos os campos antes de guardar.");
    },
    onError: (erro) => { setUploading(false); toast.error(`Não foi possível ler a fatura: ${erro.message}`); },
  });

  const confirmar = trpc.ocr.confirmarFatura.useMutation({
    onSuccess: () => {
      toast.success("Fatura guardada, entradas de stock registadas e conta criada.");
      reiniciar();
      utils.ocr.listarContasPagar.invalidate();
      utils.movimentos.listar.invalidate();
      utils.artigos.listar.invalidate();
      utils.dashboard.resumo.invalidate();
    },
    onError: (erro) => toast.error(erro.message),
  });

  const marcarPaga = trpc.ocr.marcarContaPaga.useMutation({
    onSuccess: () => { utils.ocr.listarContasPagar.invalidate(); toast.success("Conta marcada como paga."); },
    onError: (erro) => toast.error(erro.message),
  });

  const totalLinhas = useMemo(() => linhas.filter((linha) => linha.incluir).reduce((soma, linha) => soma + (Number(linha.valorLinha) || 0), 0), [linhas]);
  const diferencaTotal = Math.abs(totalLinhas - ficha.valorTotal);
  const podeMarcarPaga = user?.role === "admin" || user?.role === "head_chef";

  async function ficheiroParaBase64(ficheiro: File) {
    return new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve((leitor.result as string).split(",")[1]);
      leitor.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
      leitor.readAsDataURL(ficheiro);
    });
  }

  async function selecionarFicheiro(evento: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = evento.target.files?.[0];
    if (!ficheiro) return;
    if (ficheiro.size > 20 * 1024 * 1024) { toast.error("O ficheiro não pode ultrapassar 20 MB."); return; }
    setUploading(true);
    setPreviewUrl(ficheiro.type.startsWith("image/") ? URL.createObjectURL(ficheiro) : null);
    try {
      const base64 = await ficheiroParaBase64(ficheiro);
      const guardado = await uploadImagem.mutateAsync({ base64, mimeType: ficheiro.type || "image/jpeg", nome: ficheiro.name });
      processar.mutate({ imagemUrl: guardado.url, imagemKey: guardado.key, fornecedorId });
    } catch (erro: any) {
      setUploading(false);
      toast.error(erro?.message ?? "Erro ao carregar a fatura.");
    }
  }

  function atualizarLinha(indice: number, alteracao: Partial<LinhaRevisao>) {
    setLinhas((atuais) => atuais.map((linha, i) => i === indice ? { ...linha, ...alteracao } : linha));
  }

  function reiniciar() {
    setDocId(null); setFicha(FICHA_VAZIA); setFornecedorId(undefined); setLinhas([]); setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function guardarFatura() {
    if (!docId) return;
    if (!ficha.fornecedor.trim()) { toast.error("Indica o fornecedor antes de guardar."); return; }
    if (ficha.valorTotal < 0) { toast.error("O valor total não pode ser negativo."); return; }
    confirmar.mutate({
      docId, fornecedorId, fornecedorNome: ficha.fornecedor, nifFornecedor: ficha.nif || undefined, numeroFatura: ficha.numero || undefined,
      dataEmissao: ficha.dataEmissao || undefined, dataVencimento: ficha.dataVencimento || undefined, condicoesPagamento: ficha.condicoesPagamento || undefined, valorTotal: Number(ficha.valorTotal) || 0,
      linhas: linhas.map((linha) => ({ ...linha, artigoId: linha.artigoId, incluir: linha.incluir, guardarAlias: Boolean(linha.artigoId && linha.incluir) })),
    });
  }

  return <div className="mx-auto max-w-7xl space-y-6 animate-in">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold/75">Gemini · conferência obrigatória</p>
        <h1 className="mt-1 font-display text-3xl text-gold">Leitor de Faturas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Foto da fatura → revisão totalmente editável → entrada de stock e conta a pagar.</p>
      </div>
      {docId && <Button variant="outline" onClick={reiniciar} className="border-border gap-2"><X className="h-4 w-4" /> Descartar conferência</Button>}
    </div>

    {!docId ? <Card className="border-border bg-card"><CardContent className="p-6 sm:p-9">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="space-y-3"><FileImage className="h-11 w-11 text-gold" /><div><h2 className="font-display text-2xl text-foreground">1 · Carregar fatura</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Escolhe uma fotografia, imagem ou PDF. A Gemini identifica fornecedor, vencimento, total, IVA, produtos, pesos e preços. Nada é gravado sem conferência manual.</p></div></div>
        <div className="rounded-md border border-dashed border-gold/40 bg-secondary/20 p-6 text-center"><input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={selecionarFicheiro} /><Upload className="mx-auto h-7 w-7 text-gold" /><p className="mt-3 text-sm font-medium">Fotografar ou selecionar ficheiro</p><p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP ou PDF · máximo 20 MB</p><Button onClick={() => fileRef.current?.click()} disabled={uploading || processar.isPending} className="mt-4 gap-2 bg-primary text-primary-foreground">{uploading || processar.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> A ler fatura…</> : <><Upload className="h-4 w-4" /> Selecionar ficheiro</>}</Button></div>
      </div>
    </CardContent></Card> : <div className="space-y-4">
      {previewUrl && <Card className="overflow-hidden border-border bg-card"><CardContent className="p-0"><img src={previewUrl} alt="Pré-visualização da fatura carregada" className="max-h-80 w-full object-contain bg-black/20" /></CardContent></Card>}
      <Card className="border-gold/30 bg-card"><CardHeader className="border-b border-border pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="font-display text-2xl text-gold">2 · Ficha de conferência</CardTitle><Badge variant="outline" className="border-gold/40 text-gold">Edita antes de guardar</Badge></div></CardHeader><CardContent className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Campo etiqueta="Fornecedor" valor={ficha.fornecedor} onChange={(fornecedor) => setFicha((atual) => ({ ...atual, fornecedor }))} />
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Fornecedor registado</label><Select value={fornecedorId ? String(fornecedorId) : "sem_fornecedor"} onValueChange={(valor) => { const id = valor === "sem_fornecedor" ? undefined : Number(valor); const encontrado = fornecedores?.find((item) => item.id === id); setFornecedorId(id); if (encontrado) setFicha((atual) => ({ ...atual, fornecedor: encontrado.nome, nif: encontrado.nif ?? atual.nif })); }}><SelectTrigger className="h-9 bg-input border-border text-sm"><SelectValue /></SelectTrigger><SelectContent className="bg-popover border-border"><SelectItem value="sem_fornecedor">Não associado</SelectItem>{fornecedores?.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <Campo etiqueta="NIF" valor={ficha.nif} onChange={(nif) => setFicha((atual) => ({ ...atual, nif }))} />
          <Campo etiqueta="Nº da fatura" valor={ficha.numero} onChange={(numero) => setFicha((atual) => ({ ...atual, numero }))} />
          <Campo etiqueta="Data de emissão" tipo="date" valor={ficha.dataEmissao} onChange={(dataEmissao) => setFicha((atual) => ({ ...atual, dataEmissao }))} />
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Data de vencimento {ficha.dataVencimentoCalculada && <span className="ml-1 text-gold">calculada</span>}</label><Input type="date" value={ficha.dataVencimento} onChange={(evento) => setFicha((atual) => ({ ...atual, dataVencimento: evento.target.value, dataVencimentoCalculada: false }))} className="h-9 bg-input border-border" /></div>
          <Campo etiqueta="Condições de pagamento" valor={ficha.condicoesPagamento} onChange={(condicoesPagamento) => setFicha((atual) => ({ ...atual, condicoesPagamento }))} />
          <Campo etiqueta="Valor total (€)" tipo="number" valor={String(ficha.valorTotal)} onChange={(valor) => setFicha((atual) => ({ ...atual, valorTotal: Number(valor) || 0 }))} />
        </div>
        <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${diferencaTotal < 0.05 ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}>{diferencaTotal < 0.05 ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />} Soma das linhas selecionadas: <strong>{moeda.format(totalLinhas)}</strong> · Total da fatura: <strong>{moeda.format(ficha.valorTotal)}</strong>{diferencaTotal >= 0.05 && " · Confirma a diferença antes de guardar."}</div>
      </CardContent></Card>
      <Card className="border-border bg-card"><CardHeader className="border-b border-border pb-3"><CardTitle className="font-display text-xl text-gold">Produtos e impostos</CardTitle><p className="text-xs text-muted-foreground">Seleciona o artigo de stock apenas nas linhas que devem criar entrada. Todos os campos são editáveis.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1170px] text-sm"><thead><tr className="border-b border-border bg-secondary/30 text-left text-xs text-muted-foreground"><th className="px-3 py-3">Entrar</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Artigo no stock</th><th className="px-3 py-3 text-right">Qtd.</th><th className="px-3 py-3">Peso / un.</th><th className="px-3 py-3 text-right">€/kg ou un.</th><th className="px-3 py-3 text-right">IVA %</th><th className="px-3 py-3 text-right">IVA €</th><th className="px-3 py-3 text-right">Linha €</th><th className="px-3 py-3">Leitura</th></tr></thead><tbody>{linhas.map((linha, indice) => <tr key={indice} className={`border-b border-border last:border-0 ${linha.incluir ? "" : "opacity-55"}`}><td className="px-3 py-2"><input aria-label={`Incluir ${linha.descricao}`} type="checkbox" checked={linha.incluir} onChange={(evento) => atualizarLinha(indice, { incluir: evento.target.checked })} className="h-4 w-4 accent-yellow-500" /></td><td className="px-3 py-2"><Input value={linha.descricao} onChange={(evento) => atualizarLinha(indice, { descricao: evento.target.value })} className="h-8 min-w-40 bg-input border-border text-xs" /></td><td className="px-3 py-2"><Select value={linha.artigoId ? String(linha.artigoId) : "sem_artigo"} onValueChange={(valor) => { const artigo = artigos?.find((item) => item.id === Number(valor)); atualizarLinha(indice, { artigoId: valor === "sem_artigo" ? undefined : Number(valor), artigoNome: artigo?.nome, incluir: valor !== "sem_artigo" ? true : linha.incluir }); }}><SelectTrigger className="h-8 min-w-48 bg-input border-border text-xs"><SelectValue /></SelectTrigger><SelectContent className="max-h-60 bg-popover border-border"><SelectItem value="sem_artigo">Não criar entrada</SelectItem>{artigos?.map((artigo) => <SelectItem key={artigo.id} value={String(artigo.id)}>{artigo.nome}</SelectItem>)}</SelectContent></Select></td><CelulaNumero valor={linha.quantidade} onChange={(quantidade) => atualizarLinha(indice, { quantidade })} /><td className="px-3 py-2"><Input value={linha.pesoOuUnidade || linha.unidade} onChange={(evento) => atualizarLinha(indice, { pesoOuUnidade: evento.target.value, unidade: evento.target.value })} className="h-8 w-24 bg-input border-border text-xs" /></td><CelulaNumero valor={linha.precoPorUnidade} onChange={(precoPorUnidade) => atualizarLinha(indice, { precoPorUnidade })} /><CelulaNumero valor={linha.taxaIva} onChange={(taxaIva) => atualizarLinha(indice, { taxaIva })} /><CelulaNumero valor={linha.valorIva} onChange={(valorIva) => atualizarLinha(indice, { valorIva })} /><CelulaNumero valor={linha.valorLinha} onChange={(valorLinha) => atualizarLinha(indice, { valorLinha })} /><td className="px-3 py-2"><Badge className={linha.confianca === "alta" ? "bg-success/20 text-success" : linha.confianca === "baixa" ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"}>{linha.confianca}</Badge></td></tr>)}</tbody></table></div></CardContent></Card>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-sm text-muted-foreground">{linhas.filter((linha) => linha.incluir && linha.artigoId && linha.quantidade > 0).length} linha(s) gerarão entrada de stock. A conta a pagar será criada mesmo sem artigo associado.</p><div className="flex gap-2"><Button variant="outline" onClick={reiniciar} className="border-border">Cancelar</Button><Button onClick={guardarFatura} disabled={confirmar.isPending} className="gap-2 bg-primary text-primary-foreground">{confirmar.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> A guardar…</> : <><CheckCircle2 className="h-4 w-4" /> Confirmar e guardar</>}</Button></div></div>
    </div>}

    <Card className="border-border bg-card"><CardHeader className="border-b border-border pb-3"><div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-gold" /><CardTitle className="font-display text-2xl text-gold">Contas a pagar</CardTitle></div><p className="text-sm text-muted-foreground">O estado é calculado pela data de vencimento: pendente, atrasado ou paga.</p></CardHeader><CardContent className="p-0">{aCarregarContas ? <div className="p-6 text-sm text-muted-foreground">A carregar contas…</div> : !contasPagar?.length ? <div className="p-6 text-sm text-muted-foreground">Ainda não existem faturas confirmadas para pagamento.</div> : <div className="divide-y divide-border">{contasPagar.map((conta) => <div key={conta.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{conta.fornecedorNomeApresentacao}{conta.numeroFatura ? ` · ${conta.numeroFatura}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">Emissão: {dataApresentacao(conta.dataEmissao)} · Vencimento: {dataApresentacao(conta.dataVencimento)}{conta.condicoesPagamento ? ` · ${conta.condicoesPagamento}` : ""}</p></div><div className="flex items-center gap-3"><strong className="tabular-nums">{moeda.format(Number(conta.valorTotal))}</strong><Badge variant="outline" className={classeEstado(conta.estado)}>{conta.estado}</Badge>{conta.estado !== "paga" && podeMarcarPaga && <Button size="sm" variant="outline" onClick={() => marcarPaga.mutate({ id: conta.id })} disabled={marcarPaga.isPending} className="border-border">Marcar paga</Button>}</div></div>)}</div>}</CardContent></Card>
  </div>;
}

function Campo({ etiqueta, valor, onChange, tipo = "text" }: { etiqueta: string; valor: string; onChange: (valor: string) => void; tipo?: "text" | "number" | "date" }) {
  return <div className="space-y-1"><label className="text-xs text-muted-foreground">{etiqueta}</label><Input type={tipo} step={tipo === "number" ? "0.01" : undefined} value={valor} onChange={(evento) => onChange(evento.target.value)} className="h-9 bg-input border-border" /></div>;
}

function CelulaNumero({ valor, onChange }: { valor: number; onChange: (valor: number) => void }) {
  return <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={Number.isFinite(valor) ? valor : 0} onChange={(evento) => onChange(Number(evento.target.value) || 0)} className="h-8 w-24 bg-input border-border text-right text-xs tabular-nums" /></td>;
}
