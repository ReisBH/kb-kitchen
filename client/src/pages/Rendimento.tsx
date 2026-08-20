import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { filtrarArtigosLimposDoBruto, filtrarProteinasParaRendimento } from "@/lib/rendimentoProteinas";
import { FlaskConical, Plus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

type FormValues = {
  artigoId: string;
  artigoLimpoId: string;
  pesoBruto: string;
  pesoLimpo: string;
  precoKgBruto: string;
};

export default function Rendimento() {
  const [showForm, setShowForm] = useState(true);
  const [showComparador, setShowComparador] = useState(false);
  const [idCliente, setIdCliente] = useState(() => crypto.randomUUID());
  const utils = trpc.useUtils();
  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: "ingrediente" });
  const { data: artigosLimpos, isLoading: artigosLimposACarregar } = trpc.artigos.listar.useQuery({ tipo: "proteina_limpa" });
  const proteinas = useMemo(() => filtrarProteinasParaRendimento(artigos ?? []), [artigos]);
  const { data: testes, isLoading } = trpc.rendimento.listar.useQuery();
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormValues>();

  const registar = trpc.rendimento.registar.useMutation({
    onSuccess: (d) => {
      toast.success(
        `Rendimento registado — ${fmt(d.aproveitamentoPct, 1)}% aproveitamento · ${fmt(d.custoRealPorKg / 1000, 6)} €/g`
      );
      utils.rendimento.listar.invalidate();
      reset();
      setIdCliente(crypto.randomUUID());
      setShowForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // Valores em tempo real para pré-visualização
  const pesoBruto = parseFloat(watch("pesoBruto") || "0");
  const pesoLimpo = parseFloat(watch("pesoLimpo") || "0");
  const precoKg = parseFloat(watch("precoKgBruto") || "0");

  // Custo total pago = pesoBruto (g) / 1000 * precoKg (€/kg)
  const custoTotalPago = (pesoBruto / 1000) * precoKg;
  // Custo real por grama do produto limpo
  const custoRealPorGrama = pesoLimpo > 0 ? custoTotalPago / pesoLimpo : 0;
  const custoRealPorKg = custoRealPorGrama * 1000;
  const aproveitamento = pesoBruto > 0 ? (pesoLimpo / pesoBruto) * 100 : 0;
  const precoKgBrutoEquiv = precoKg; // referência de comparação
  const sobrecustoPct = precoKg > 0 ? ((custoRealPorKg - precoKg) / precoKg) * 100 : 0;

  const podePrevisualizar = pesoBruto > 0 && pesoLimpo > 0 && precoKg > 0;

  const comparativoProteinas = useMemo<Array<{ nome: string; testes: number; aproveitamentoMedio: number; custoMedioKg: number }>>(() => {
    const grupos = new Map<string, { testes: number; aproveitamento: number; custoKg: number }>();
    for (const teste of testes ?? []) {
      const chave = teste.artigoNome ?? "Sem proteína";
      const atual = grupos.get(chave) ?? { testes: 0, aproveitamento: 0, custoKg: 0 };
      atual.testes += 1;
      atual.aproveitamento += Number(teste.aproveitamentoPct ?? 0);
      atual.custoKg += Number(teste.custoRealPorKg ?? 0);
      grupos.set(chave, atual);
    }
    return Array.from(grupos.entries()).map(([nome, valores]) => ({
      nome,
      testes: valores.testes,
      aproveitamentoMedio: valores.aproveitamento / valores.testes,
      custoMedioKg: valores.custoKg / valores.testes,
    })).sort((a, b) => b.aproveitamentoMedio - a.aproveitamentoMedio);
  }, [testes]);

  const artigoIdWatch = watch("artigoId");
  const artigoBrutoSelecionadoId = artigoIdWatch ? parseInt(artigoIdWatch) : undefined;
  const artigosLimposDoBruto = useMemo(
    () => filtrarArtigosLimposDoBruto(artigosLimpos ?? [], artigoBrutoSelecionadoId),
    [artigoBrutoSelecionadoId, artigosLimpos],
  );

  // Seleciona automaticamente o destino apenas quando existe uma ligação explícita ao artigo bruto.
  useEffect(() => {
    if (artigosLimposDoBruto.length === 1) {
      setValue("artigoLimpoId", String(artigosLimposDoBruto[0].id));
      return;
    }
    setValue("artigoLimpoId", "");
  }, [artigosLimposDoBruto, setValue]);

  function onSubmit(d: FormValues) {
    registar.mutate({
      artigoId: parseInt(d.artigoId),
      artigoLimpoId: d.artigoLimpoId ? parseInt(d.artigoLimpoId) : undefined,
      pesoBruto: parseFloat(d.pesoBruto),
      pesoLimpo: parseFloat(d.pesoLimpo),
      precoKgBruto: parseFloat(d.precoKgBruto),
      pesoAparas: 0,
      valorAparas: 0,
      pesoDesperdicio: 0,
      criarMovimentos: true,
      idCliente,
    });
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">Rendimento de Proteínas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Calcula o custo real por grama do produto limpo a partir do preço de compra
          </p>
        </div>
        <Button
          className="bg-primary text-primary-foreground gap-2"
          onClick={() => setShowForm(s => !s)}
        >
          <Plus className="w-4 h-4" /> Novo Teste
        </Button>
      </div>

      {(testes?.length ?? 0) > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gold" /> Comparador de Proteínas
            </CardTitle>
            <Button size="sm" variant="outline" className="border-border" onClick={() => setShowComparador(v => !v)}>
              {showComparador ? "Ocultar" : "Comparar"}
            </Button>
          </CardHeader>
          {showComparador && (
            <CardContent className="pt-0 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wide">Proteína</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase tracking-wide">Testes</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase tracking-wide">Aproveitamento médio</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase tracking-wide">Custo médio limpo</th>
                </tr></thead>
                <tbody>{comparativoProteinas.map((proteina) => (
                  <tr key={proteina.nome} className="border-b border-border/60">
                    <td className="py-2.5 font-medium">{proteina.nome}</td>
                    <td className="py-2.5 text-right">{proteina.testes}</td>
                    <td className="py-2.5 text-right text-gold">{fmt(proteina.aproveitamentoMedio, 1)}%</td>
                    <td className="py-2.5 text-right">{fmt(proteina.custoMedioKg, 2)} €/kg</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          )}
        </Card>
      )}

      {showForm && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Registar Teste de Rendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Artigo */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Proteína <span className="text-danger">*</span>
                </label>
                <select
                  {...register("artigoId", { required: "Selecciona a proteína" })}
                  className="w-full h-9 rounded-md bg-input border border-border text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— seleccionar proteína —</option>
                  {proteinas?.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
                {errors.artigoId && (
                  <p className="text-xs text-danger mt-1">{errors.artigoId.message}</p>
                )}
              </div>

              {/* Artigo limpo (destino da transformação) */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Artigo limpo (destino no stock) <span className="text-danger">*</span>
                </label>
                <select
                  {...register("artigoLimpoId", { required: "Selecciona o artigo limpo de destino" })}
                  className="w-full h-9 rounded-md bg-input border border-border text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— seleccionar artigo limpo —</option>
                  {artigosLimposDoBruto.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
                {errors.artigoLimpoId && (
                  <p className="text-xs text-danger mt-1">{errors.artigoLimpoId.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  O stock deste artigo será incrementado com o peso limpo registado.
                </p>
                {artigoBrutoSelecionadoId && !artigosLimposACarregar && artigosLimposDoBruto.length === 0 && (
                  <p className="text-xs text-warning mt-1">
                    Ainda não existe um artigo limpo associado a esta proteína. Cria primeiro o respetivo destino no stock.
                  </p>
                )}
              </div>

              {/* Os 3 campos obrigatórios */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Preço de compra (€/kg) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      {...register("precoKgBruto", { required: "Campo obrigatório", min: { value: 0.01, message: "Deve ser > 0" } })}
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      className="bg-input border-border pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/kg</span>
                  </div>
                  {errors.precoKgBruto && (
                    <p className="text-xs text-danger mt-1">{errors.precoKgBruto.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Peso bruto (g) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      {...register("pesoBruto", { required: "Campo obrigatório", min: { value: 1, message: "Deve ser > 0" } })}
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="0"
                      className="bg-input border-border pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
                  </div>
                  {errors.pesoBruto && (
                    <p className="text-xs text-danger mt-1">{errors.pesoBruto.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Peso limpo (g) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      {...register("pesoLimpo", { required: "Campo obrigatório", min: { value: 0.1, message: "Deve ser > 0" } })}
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="0"
                      className="bg-input border-border pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
                  </div>
                  {errors.pesoLimpo && (
                    <p className="text-xs text-danger mt-1">{errors.pesoLimpo.message}</p>
                  )}
                </div>
              </div>

              {/* Pré-visualização em tempo real */}
              {podePrevisualizar && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Resultado calculado</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Custo por grama limpa</p>
                      <p className="font-display text-2xl text-gold">{fmt(custoRealPorGrama, 6)}</p>
                      <p className="text-xs text-muted-foreground">€/g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Custo por kg limpo</p>
                      <p className="font-display text-2xl text-gold">{fmt(custoRealPorKg, 2)}</p>
                      <p className="text-xs text-muted-foreground">€/kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Aproveitamento</p>
                      <p className="font-display text-2xl text-gold">{fmt(aproveitamento, 1)}%</p>
                      <p className="text-xs text-muted-foreground">do peso bruto</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Sobrecusto</p>
                      <p className={`font-display text-2xl ${sobrecustoPct > 0 ? "text-warning" : "text-success"}`}>
                        +{fmt(sobrecustoPct, 1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">vs. preço bruto</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground text-center">
                    Custo total pago: <span className="text-foreground font-mono">{fmt(custoTotalPago, 4)} €</span>
                    {" "}÷ peso limpo <span className="text-foreground font-mono">{fmt(pesoLimpo, 0)} g</span>
                    {" "}= <span className="text-gold font-mono">{fmt(custoRealPorGrama, 6)} €/g</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  onClick={() => { reset(); setShowForm(false); }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={registar.isPending}
                  className="flex-1 bg-primary text-primary-foreground"
                >
                  {registar.isPending ? "A registar…" : "Registar Teste"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-card rounded animate-pulse" />
          ))}
        </div>
      ) : (testes?.length ?? 0) === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Ainda não há testes de rendimento. Regista o primeiro para calcular o custo real das proteínas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Proteína", "Bruto (g)", "Limpo (g)", "Aproveit.", "Preço/kg Compra", "Custo/g Limpa", "Custo/kg Limpo", "Sobrecusto", "Data"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testes!.map(t => {
                const custoKg = parseFloat(t.custoRealPorKg ?? "0");
                const custoG = custoKg / 1000;
                const precoCompra = parseFloat(t.precoKgBruto);
                const sobrecusto = precoCompra > 0 ? ((custoKg - precoCompra) / precoCompra) * 100 : 0;
                return (
                  <tr key={t.id} className="border-b border-border hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-medium">{t.artigoNome}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(parseFloat(t.pesoBruto), 0)}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(parseFloat(t.pesoLimpo), 0)}</td>
                    <td className="px-4 py-2.5 font-mono text-gold">{fmt(parseFloat(t.aproveitamentoPct ?? "0"), 1)}%</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(precoCompra, 2)} €/kg</td>
                    <td className="px-4 py-2.5 font-mono text-gold font-semibold">{fmt(custoG, 6)} €/g</td>
                    <td className="px-4 py-2.5 font-mono text-warning">{fmt(custoKg, 2)} €/kg</td>
                    <td className="px-4 py-2.5 font-mono text-danger">+{fmt(sobrecusto, 1)}%</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd/MM/yyyy")}</td>
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
