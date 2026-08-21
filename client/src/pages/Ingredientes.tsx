import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, Search, Filter, AlertTriangle, TrendingDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { prepararNovoArtigo } from "@/lib/novoArtigo";

function fmt(n: number | string, d = 2) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function stockStatus(stock: number, minimo: number, ponto: number, maximo: number) {
  if (stock < 0) return { label: "Negativo", color: "text-danger", bg: "bg-danger/10" };
  if (stock < minimo) return { label: "Abaixo do mínimo", color: "text-warning", bg: "bg-warning/10" };
  if (ponto > 0 && stock <= ponto) return { label: "Ponto de encomenda", color: "text-info", bg: "bg-info/10" };
  if (maximo > 0 && stock > maximo) return { label: "Excesso", color: "text-muted-foreground", bg: "bg-secondary" };
  return { label: "OK", color: "text-success", bg: "bg-success/10" };
}

function NovoArtigoForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, reset, control, watch, setValue } = useForm<any>({ defaultValues: { unidadeBase: "g", requerLimpeza: false } });
  const categoriaWatch = watch("categoria") ?? "";
  const [aCriarCategoria, setACriarCategoria] = useState(false);
  const isProteina = ["Peixe", "Carnes e Aves"].includes(categoriaWatch);
  const nomeWatch = watch("nome") ?? "";
  const { data: todosArtigos } = trpc.artigos.listar.useQuery({ apenasAtivos: false });
  const duplicado = nomeWatch.trim().length > 1
    ? todosArtigos?.find(a => a.nome.toLowerCase() === nomeWatch.trim().toLowerCase())
    : null;
  const utils = trpc.useUtils();
  const criar = trpc.artigos.criar.useMutation({
    onSuccess: () => {
      toast.success("Artigo criado com sucesso");
      utils.artigos.listar.invalidate();
      reset();
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: fornecedores } = trpc.fornecedores.listar.useQuery();
  const { data: categorias } = trpc.artigos.categorias.useQuery();

  return (
    <form onSubmit={handleSubmit((d) => criar.mutate({ ...prepararNovoArtigo(d), tipo: "ingrediente" } as any))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
          <Input {...register("nome", { required: true })} placeholder="ex: Tomate cherry" className={`bg-input border-border ${duplicado ? "border-warning ring-1 ring-warning/50" : ""}`} />
          {duplicado && (
            <p className="text-xs text-warning mt-1 flex items-center gap-1">
              <span>⚠</span>
              Já existe um artigo com este nome: <strong>"{duplicado.nome}"</strong> ({duplicado.ativo ? "activo" : "inactivo"}).
              {!duplicado.ativo && " O artigo existente está inactivo — considera reactivá-lo em vez de criar um novo."}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
          <Select value={aCriarCategoria ? "__nova__" : categoriaWatch || "__sem_categoria__"} onValueChange={(valor) => {
            if (valor === "__nova__") {
              setACriarCategoria(true);
              setValue("categoria", "");
              return;
            }
            setACriarCategoria(false);
            setValue("categoria", valor === "__sem_categoria__" ? "" : valor);
          }}>
            <SelectTrigger className="bg-input border-border h-9"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="__sem_categoria__">— sem categoria —</SelectItem>
              {(categorias ?? []).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              <SelectItem value="__nova__">+ Criar nova categoria</SelectItem>
            </SelectContent>
          </Select>
          {aCriarCategoria && <Input {...register("categoria")} autoFocus placeholder="Nome da nova categoria" className="mt-2 bg-input border-border" />}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unidade base *</label>
          <Controller
            name="unidadeBase"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-input border-border h-9">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="g">g — gramas (sólidos)</SelectItem>
                  <SelectItem value="ml">ml — mililitros (líquidos)</SelectItem>
                  <SelectItem value="un">un — unidades</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unidade de compra</label>
          <Input {...register("unidadeCompra")} placeholder="ex: kg" className="bg-input border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fator de conversão</label>
          <Input {...register("fatorConversao")} type="number" step="0.001" defaultValue="1" className="bg-input border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Stock mínimo</label>
          <Input {...register("stockMinimo")} type="number" step="0.001" defaultValue="0" className="bg-input border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Stock máximo</label>
          <Input {...register("stockMaximo")} type="number" min="0" step="0.001" placeholder="Repor até este nível" className="bg-input border-border" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fornecedor</label>
          <select {...register("fornecedorId")} className="w-full h-9 rounded-md bg-input border border-border text-sm px-3">
            <option value="">— sem fornecedor —</option>
            {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>
      {isProteina && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-warning/5 border border-warning/20">
          <Controller
            name="requerLimpeza"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="requerLimpeza"
                checked={!!field.value}
                onCheckedChange={field.onChange}
                className="border-warning data-[state=checked]:bg-warning data-[state=checked]:border-warning"
              />
            )}
          />
          <label htmlFor="requerLimpeza" className="text-sm cursor-pointer">
            <span className="font-medium">Requer limpeza manual</span>
            <span className="text-xs text-muted-foreground block">Aparece na lista do Rendimento de Proteínas</span>
          </label>
        </div>
      )}
      <Button type="submit" disabled={criar.isPending || !!duplicado} className={`w-full bg-primary text-primary-foreground ${duplicado ? "opacity-50 cursor-not-allowed" : ""}`}>
        {criar.isPending ? "A criar…" : "Criar Artigo"}
      </Button>
    </form>
  );
}

export default function Ingredientes() {
  const [pesquisa, setPesquisa] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: artigos, isLoading } = trpc.artigos.listar.useQuery({
    pesquisa: pesquisa || undefined,
    categoria: categoria !== "todas" ? categoria : undefined,
    apenasAtivos: true,
  });
  const { data: categorias } = trpc.artigos.categorias.useQuery();

  const filtrados = artigos?.filter(a =>
    tipoFiltro === "todos" ? true :
    tipoFiltro === "abaixo" ? a.stockAtual < parseFloat(a.stockMinimo ?? "0") :
    tipoFiltro === "negativo" ? a.stockAtual < 0 :
    true
  ) ?? [];

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">Ingredientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{artigos?.length ?? 0} artigos activos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Novo Artigo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-gold">Novo Ingrediente</DialogTitle>
            </DialogHeader>
            <NovoArtigoForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={pesquisa} onChange={e => setPesquisa(e.target.value)}
            placeholder="Pesquisar artigos…" className="pl-9 bg-input border-border" />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-44 bg-input border-border">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-44 bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="abaixo">Abaixo do mínimo</SelectItem>
            <SelectItem value="negativo">Stock negativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-card rounded animate-pulse" />)}</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Ainda não há ingredientes. Cria o primeiro a partir dos ingredientes que já tens.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Artigo</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Categoria</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Stock Actual</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Mínimo</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Máximo</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Unid.</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Custo Médio</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Valor em Stock</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Fornecedor</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(a => {
                const status = stockStatus(a.stockAtual, parseFloat(a.stockMinimo ?? "0"), parseFloat(a.pontoEncomenda ?? "0"), parseFloat(a.stockMaximo ?? "0"));
                const valorStock = a.stockAtual * parseFloat(a.custoMedioPonderado ?? "0");
                return (
                  <tr key={a.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/ingredientes/${a.id}`}>
                        <span className="hover:text-gold cursor-pointer font-medium transition-colors">{a.nome}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.categoria ?? "—"}</td>
                    <td className={cn("px-4 py-3 text-right font-mono", status.color)}>
                      {fmt(a.stockAtual, 2)} {a.unidadeBase}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono">
                      {fmt(parseFloat(a.stockMinimo ?? "0"), 2)} {a.unidadeBase}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono">
                      {a.stockMaximo == null ? "—" : `${fmt(parseFloat(a.stockMaximo), 2)} ${a.unidadeBase}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${a.unidadeBase === "ml" ? "border-info/40 text-info bg-info/10" : a.unidadeBase === "un" ? "border-muted-foreground/30 text-muted-foreground" : "border-success/40 text-success bg-success/10"}`}>
                        {a.unidadeBase}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {(() => {
                        const cmp = parseFloat(a.custoMedioPonderado ?? "0");
                        if (a.unidadeBase === "g") return `${fmt(cmp * 1000, 2)} €/kg`;
                        if (a.unidadeBase === "ml") return `${fmt(cmp * 1000, 2)} €/l`;
                        return `${fmt(cmp, 4)} €/un`;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gold">
                      {fmt(valorStock)} €
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{a.fornecedorNome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", status.bg, status.color)}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
