import React, { useMemo, useState } from "react";
import { BookOpen, ChefHat, ChevronDown, ChevronRight, PackageSearch, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { filtrarOpcoesComponentes, type OpcaoPesquisaComponente } from "@/lib/pesquisaComponentes";
import type { ReactNode } from "react";

type OpcaoComponente = OpcaoPesquisaComponente;

export function SeletorComponentePesquisavel({
  value,
  onChange,
  opcoes,
  onSelecionarFicha,
  permitirReferenciaFicha = false,
  tipoSelecionado = "artigo",
  permitirExpansaoFicha = false,
  fichaExpandida = false,
  onAlternarFichaExpandida,
  conteudoFichaExpandida,
}: {
  value: string;
  onChange: (id: string, tipo?: "artigo" | "ficha") => void;
  opcoes: OpcaoComponente[];
  onSelecionarFicha?: (id: number) => void;
  permitirReferenciaFicha?: boolean;
  tipoSelecionado?: "artigo" | "ficha";
  permitirExpansaoFicha?: boolean;
  fichaExpandida?: boolean;
  onAlternarFichaExpandida?: () => void;
  conteudoFichaExpandida?: ReactNode;
}) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(() => new URLSearchParams(window.location.search).get("pesquisarComponentes") === "1");
  const selecionado = opcoes.find((opcao) => String(opcao.id) === value && (tipoSelecionado === "ficha" ? opcao.tipo === "ficha_tecnica" : opcao.tipo !== "ficha_tecnica"));
  const resultados = useMemo(() => filtrarOpcoesComponentes(opcoes, termo), [opcoes, termo]);

  const selecionar = (opcao: OpcaoComponente) => {
    if (opcao.tipo === "ficha_tecnica" && permitirReferenciaFicha) onChange(String(opcao.id), "ficha");
    else if (opcao.tipo === "ficha_tecnica") onSelecionarFicha?.(opcao.id);
    else onChange(String(opcao.id));
    setTermo("");
    setAberto(false);
  };

  return (
    <div className="relative min-w-0 flex-1">
      {selecionado && !aberto ? (
        <div className="space-y-1">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-input px-3 text-sm">
            {selecionado.tipo === "ficha_tecnica" && permitirExpansaoFicha ? <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-gold" title={fichaExpandida ? "Ocultar ingredientes" : "Mostrar ingredientes"} onClick={onAlternarFichaExpandida}>{fichaExpandida ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</Button> : selecionado.tipo === "ficha_tecnica" ? <BookOpen className="h-3.5 w-3.5 shrink-0 text-gold" /> : selecionado.tipo === "receita_base" ? <ChefHat className="h-3.5 w-3.5 shrink-0 text-gold" /> : <PackageSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {selecionado.tipo === "ficha_tecnica" && permitirExpansaoFicha && <BookOpen className="h-3.5 w-3.5 shrink-0 text-gold" />}
            <span className="min-w-0 flex-1 truncate">{selecionado.nome} <span className="text-muted-foreground">({selecionado.unidadeBase})</span></span>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Alterar componente" onClick={() => setAberto(true)}><Search className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-danger" title="Limpar componente" onClick={() => onChange("")}><X className="h-3.5 w-3.5" /></Button>
          </div>
          {fichaExpandida && selecionado.tipo === "ficha_tecnica" && conteudoFichaExpandida}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus={aberto}
              value={termo}
              onFocus={() => setAberto(true)}
              onChange={(event) => { setTermo(event.target.value); setAberto(true); }}
              placeholder="Pesquisar ingrediente ou receita…"
              className="h-9 bg-input pl-9 pr-8"
            />
            {value && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" title="Cancelar pesquisa" onClick={() => { setAberto(false); setTermo(""); }}><X className="h-3.5 w-3.5" /></Button>}
          </div>
          {aberto && (
            <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-xl">
              {resultados.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum ingrediente ou receita encontrado.</p> : resultados.map((opcao) => (
                <button key={`${opcao.tipo}-${opcao.id}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selecionar(opcao)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-secondary">
                  {opcao.tipo === "ficha_tecnica" ? <BookOpen className="h-4 w-4 shrink-0 text-gold" /> : opcao.tipo === "receita_base" ? <ChefHat className="h-4 w-4 shrink-0 text-gold" /> : <PackageSearch className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{opcao.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{opcao.tipo === "ficha_tecnica" ? (permitirReferenciaFicha ? "Ficha técnica" : "Ficha · copiar componentes") : opcao.tipo === "receita_base" ? "Receita" : "Ingrediente"} · {opcao.unidadeBase}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
