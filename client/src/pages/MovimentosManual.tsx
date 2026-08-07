import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, RotateCcw, CheckCircle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Modo = "entrada" | "saida";
type Agrupamento = "categoria" | "fornecedor";

type EntradaItem = {
  artigoId: number;
  quantidade: string;
  custo: string; // €/kg or €/l
  motivo: string;
};

type SaidaItem = {
  artigoId: number;
  quantidade: string;
  motivo: string;
  isWaste: boolean;
};

function fmt(n: number | string, d = 2) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function MovimentosManual() {
  const [modo, setModo] = useState<Modo>("entrada");
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("categoria");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [pesquisa, setPesquisa] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Per-item state maps: artigoId → values
  const [entradas, setEntradas] = useState<Record<number, EntradaItem>>({});
  const [saidas, setSaidas] = useState<Record<number, SaidaItem>>({});

  const utils = trpc.useUtils();
  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: "ingrediente" });
  const { data: fornecedores } = trpc.fornecedores.listar.useQuery();

  const registarEntrada = trpc.movimentos.registarEntradaManual.useMutation();
  const registarSaida = trpc.movimentos.registarSaidaManual.useMutation();

  // Unique categories and suppliers from loaded artigos
  const categorias = useMemo(() => {
    const set = new Set<string>();
    artigos?.forEach(a => { if (a.categoria) set.add(a.categoria); });
    return Array.from(set).sort();
  }, [artigos]);

  // Filter artigos based on active filters and search
  const artigosFiltrados = useMemo(() => {
    if (!artigos) return [];
    return artigos.filter(a => {
      if (filtroFornecedor !== "todos" && String(a.fornecedorId ?? "") !== filtroFornecedor) return false;
      if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
      if (pesquisa && !a.nome.toLowerCase().includes(pesquisa.toLowerCase())) return false;
      return true;
    });
  }, [artigos, filtroFornecedor, filtroCategoria, pesquisa]);

  // Group artigos by chosen grouping
  const grupos = useMemo(() => {
    const map: Record<string, typeof artigosFiltrados> = {};
    artigosFiltrados.forEach(a => {
      const key = agrupamento === "fornecedor"
        ? (a.fornecedorNome ?? "Sem fornecedor")
        : (a.categoria ?? "Outros");
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    // Sort groups alphabetically
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "pt"));
  }, [artigosFiltrados, agrupamento]);

  // Count items with values filled
  const totalEntradas = Object.values(entradas).filter(e => parseFloat(e.quantidade) > 0).length;
  const totalSaidas = Object.values(saidas).filter(s => parseFloat(s.quantidade) > 0).length;
  const totalPendente = modo === "entrada" ? totalEntradas : totalSaidas;

  function toggleGrupo(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function setEntrada(artigoId: number, field: keyof EntradaItem, value: string) {
    setEntradas(prev => ({
      ...prev,
      [artigoId]: { ...(prev[artigoId] ?? { artigoId, quantidade: "", custo: "", motivo: "" }), [field]: value },
    }));
  }

  function setSaida(artigoId: number, field: keyof SaidaItem, value: string) {
    setSaidas(prev => ({
      ...prev,
      [artigoId]: { ...(prev[artigoId] ?? { artigoId, quantidade: "", motivo: "", isWaste: false }), [field]: value },
    }));
  }

  function setWaste(artigoId: number, value: boolean) {
    setSaidas(prev => ({
      ...prev,
      [artigoId]: { ...(prev[artigoId] ?? { artigoId, quantidade: "", motivo: "", isWaste: false }), isWaste: value },
    }));
  }
  function limpar() {
    setEntradas({});
    setSaidas({});
  }

  async function submeter() {
    if (modo === "entrada") {
      const linhas = Object.values(entradas).filter(e => parseFloat(e.quantidade) > 0);
      if (linhas.length === 0) { toast.error("Preenche pelo menos uma quantidade."); return; }
      let ok = 0;
      let erros = 0;
      for (const linha of linhas) {
        const artigo = artigos?.find(a => a.id === linha.artigoId);
        if (!artigo) continue;
        const qtd = parseFloat(linha.quantidade);
        const custoKg = parseFloat(linha.custo);
        if (isNaN(qtd) || qtd <= 0) { erros++; continue; }
        if (isNaN(custoKg) || custoKg < 0) { erros++; continue; }
        // Convert €/kg or €/l to €/g or €/ml
        const custoBase = (artigo.unidadeBase === "g" || artigo.unidadeBase === "ml") ? custoKg / 1000 : custoKg;
        try {
          await registarEntrada.mutateAsync({ artigoId: linha.artigoId, quantidade: qtd, custoUnitario: custoBase, motivo: linha.motivo || undefined });
          ok++;
        } catch { erros++; }
      }
      if (ok > 0) {
        toast.success(`${ok} entrada(s) registada(s) com sucesso.${erros > 0 ? ` ${erros} erro(s).` : ""}`);
        setEntradas({});
        utils.artigos.listar.invalidate();
        utils.movimentos.listar.invalidate();
        utils.dashboard.resumo.invalidate();
      } else {
        toast.error("Nenhuma entrada registada. Verifica os valores.");
      }
    } else {
      const linhas = Object.values(saidas).filter(s => parseFloat(s.quantidade) > 0);
      if (linhas.length === 0) { toast.error("Preenche pelo menos uma quantidade."); return; }
      let ok = 0;
      let erros = 0;
      for (const linha of linhas) {
        const qtd = parseFloat(linha.quantidade);
        if (isNaN(qtd) || qtd <= 0) { erros++; continue; }
        try {
          await registarSaida.mutateAsync({ artigoId: linha.artigoId, quantidade: qtd, motivo: linha.isWaste ? (linha.motivo || "Waste") : (linha.motivo || undefined), isWaste: linha.isWaste });
          ok++;
        } catch { erros++; }
      }
      if (ok > 0) {
        toast.success(`${ok} saída(s) registada(s) com sucesso.${erros > 0 ? ` ${erros} erro(s).` : ""}`);
        setSaidas({});
        utils.artigos.listar.invalidate();
        utils.movimentos.listar.invalidate();
        utils.dashboard.resumo.invalidate();
      } else {
        toast.error("Nenhuma saída registada. Verifica os valores.");
      }
    }
  }

  const isPending = registarEntrada.isPending || registarSaida.isPending;

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold">Entradas / Saídas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Preenche as quantidades e confirma em bloco</p>
        </div>
        {totalPendente > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={limpar} className="border-border gap-2 h-9">
              <RotateCcw className="w-4 h-4" /> Limpar
            </Button>
            <Button onClick={submeter} disabled={isPending} className="bg-primary text-primary-foreground gap-2 h-9">
              {isPending
                ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> A processar…</>
                : <><CheckCircle className="w-4 h-4" /> Confirmar {totalPendente} item(ns)</>}
            </Button>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setModo("entrada")}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${modo === "entrada" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ArrowDown className="w-4 h-4" /> Entrada
          </button>
          <button
            onClick={() => setModo("saida")}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors border-l border-border ${modo === "saida" ? "bg-danger/80 text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ArrowUp className="w-4 h-4" /> Saída
          </button>
        </div>

        {/* Grouping toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setAgrupamento("categoria")}
            className={`px-3 py-2 text-sm transition-colors ${agrupamento === "categoria" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Por Categoria
          </button>
          <button
            onClick={() => setAgrupamento("fornecedor")}
            className={`px-3 py-2 text-sm transition-colors border-l border-border ${agrupamento === "fornecedor" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Por Fornecedor
          </button>
        </div>

        {/* Supplier filter */}
        <Select value={filtroFornecedor} onValueChange={v => { setFiltroFornecedor(v); setFiltroCategoria("todas"); }}>
          <SelectTrigger className="w-48 h-9 bg-input border-border text-sm">
            <SelectValue placeholder="Filtrar fornecedor…" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos os fornecedores</SelectItem>
            {fornecedores?.map(f => (
              <SelectItem key={f.id} value={String(f.id)}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select value={filtroCategoria} onValueChange={v => { setFiltroCategoria(v); setFiltroFornecedor("todos"); }}>
          <SelectTrigger className="w-44 h-9 bg-input border-border text-sm">
            <SelectValue placeholder="Filtrar categoria…" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          value={pesquisa}
          onChange={e => setPesquisa(e.target.value)}
          placeholder="Pesquisar ingrediente…"
          className="w-52 h-9 bg-input border-border text-sm"
        />

        {totalPendente > 0 && (
          <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">
            {totalPendente} item(ns) preenchido(s)
          </Badge>
        )}
      </div>

      {/* Groups */}
      {grupos.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            Nenhum ingrediente encontrado com os filtros seleccionados.
          </CardContent>
        </Card>
      )}

      {grupos.map(([grupo, lista]) => {
        const isCollapsed = collapsed[grupo];
        const grupoComValores = lista.filter(a =>
          modo === "entrada"
            ? parseFloat(entradas[a.id]?.quantidade ?? "0") > 0
            : parseFloat(saidas[a.id]?.quantidade ?? "0") > 0
        ).length;

        return (
          <Card key={grupo} className="bg-card border-border overflow-hidden">
            <button
              onClick={() => toggleGrupo(grupo)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{grupo}</span>
                <span className="text-xs text-muted-foreground">({lista.length})</span>
              </div>
              {grupoComValores > 0 && (
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">{grupoComValores} preenchido(s)</Badge>
              )}
            </button>

            {!isCollapsed && (
              <div className="border-t border-border">
                {/* Column headers */}
                <div className={`grid gap-2 px-4 py-2 bg-secondary/20 text-xs text-muted-foreground uppercase tracking-wide ${modo === "entrada" ? "grid-cols-[1fr_100px_120px_1fr]" : "grid-cols-[1fr_100px_1fr_80px]"}`}>
                  <span>Ingrediente</span>
                  <span className="text-right">Quantidade</span>
                  {modo === "entrada" && <span className="text-right">Preço compra</span>}
                  <span>Motivo / Ref.</span>
                  {modo === "saida" && <span className="text-center">Waste</span>}
                </div>

                {lista.map(a => {
                  const entrada = entradas[a.id];
                  const saida = saidas[a.id];
                  const temValor = modo === "entrada"
                    ? parseFloat(entrada?.quantidade ?? "0") > 0
                    : parseFloat(saida?.quantidade ?? "0") > 0;

                  return (
                    <div
                      key={a.id}
                      className={`grid gap-2 px-4 py-2.5 border-b border-border last:border-0 items-center transition-colors ${temValor ? (saida?.isWaste ? "bg-orange-500/5" : "bg-primary/5") : "hover:bg-secondary/10"} ${modo === "entrada" ? "grid-cols-[1fr_100px_120px_1fr]" : "grid-cols-[1fr_100px_1fr_80px]"}`}
                    >
                      {/* Name + stock */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.nome}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Stock: {fmt(a.stockAtual ?? 0, 0)} {a.unidadeBase}
                          {a.fornecedorNome && agrupamento === "categoria" && (
                            <span className="ml-2 opacity-60">{a.fornecedorNome}</span>
                          )}
                        </p>
                      </div>

                      {/* Quantity */}
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={modo === "entrada" ? (entrada?.quantidade ?? "") : (saida?.quantidade ?? "")}
                        onChange={e => modo === "entrada"
                          ? setEntrada(a.id, "quantidade", e.target.value)
                          : setSaida(a.id, "quantidade", e.target.value)
                        }
                        placeholder={`0 ${a.unidadeBase}`}
                        className="h-8 text-right bg-input border-border text-sm tabular-nums"
                      />

                      {/* Cost (entrada only) */}
                      {modo === "entrada" && (
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={entrada?.custo ?? ""}
                          onChange={e => setEntrada(a.id, "custo", e.target.value)}
                          placeholder={a.unidadeBase === "g" ? "€/kg" : a.unidadeBase === "ml" ? "€/l" : "€/un"}
                          className="h-8 text-right bg-input border-border text-sm tabular-nums"
                        />
                      )}

                      {/* Motivo */}
                      <Input
                        value={modo === "entrada" ? (entrada?.motivo ?? "") : (saida?.motivo ?? "")}
                        onChange={e => modo === "entrada"
                          ? setEntrada(a.id, "motivo", e.target.value)
                          : setSaida(a.id, "motivo", e.target.value)
                        }
                        placeholder={modo === "saida" && saida?.isWaste ? "Waste" : "Motivo / referência…"}
                        className="h-8 bg-input border-border text-sm"
                      />
                      {/* Waste checkbox (saída only) */}
                      {modo === "saida" && (
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setWaste(a.id, !(saida?.isWaste ?? false))}
                            title="Marcar como Waste"
                            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${saida?.isWaste ? "bg-orange-500/20 text-orange-400 border border-orange-500/40" : "text-muted-foreground hover:text-orange-400 border border-transparent hover:border-orange-500/30"}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {/* Bottom confirm bar when items are filled */}
      {totalPendente > 0 && (
        <div className="sticky bottom-4 flex justify-end gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <span className="text-sm text-muted-foreground">{totalPendente} item(ns) prontos</span>
            <Button variant="outline" onClick={limpar} className="border-border gap-2 h-8 text-sm">
              <RotateCcw className="w-3.5 h-3.5" /> Limpar
            </Button>
            <Button onClick={submeter} disabled={isPending} className="bg-primary text-primary-foreground gap-2 h-8 text-sm">
              {isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> A processar…</>
                : <><CheckCircle className="w-3.5 h-3.5" /> Confirmar</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
