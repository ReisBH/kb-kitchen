import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { FlaskConical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Rendimento() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: "ingrediente" });
  const { data: proteinas } = trpc.artigos.listar.useQuery({ tipo: "proteina_limpa" });
  const { data: testes, isLoading } = trpc.rendimento.listar.useQuery();
  const { register, handleSubmit, watch, reset } = useForm<any>({ defaultValues: { pesoAparas: 0, valorAparas: 0, pesoDesperdicio: 0, criarMovimentos: true } });
  const registar = trpc.rendimento.registar.useMutation({
    onSuccess: (d) => {
      toast.success(`Rendimento registado — Aproveitamento: ${fmt(d.aproveitamentoPct, 1)}% · Custo real: ${fmt(d.custoRealPorKg, 2)} €/kg`);
      utils.rendimento.listar.invalidate();
      reset();
      setShowForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const pesoBruto = parseFloat(watch("pesoBruto") || "0");
  const pesoLimpo = parseFloat(watch("pesoLimpo") || "0");
  const precoKg = parseFloat(watch("precoKgBruto") || "0");
  const valorAparas = parseFloat(watch("valorAparas") || "0");
  const aproveitamento = pesoBruto > 0 ? (pesoLimpo / pesoBruto) * 100 : 0;
  const custoReal = pesoLimpo > 0 ? ((pesoBruto * precoKg) - valorAparas) / pesoLimpo : 0;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">Rendimento de Proteínas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Calcula o custo real por kg após limpeza</p>
        </div>
        <Button className="bg-primary text-primary-foreground gap-2" onClick={() => setShowForm(s => !s)}>
          <Plus className="w-4 h-4" /> Novo Teste
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Registar Teste de Rendimento</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(d => registar.mutate({ ...d, pesoBruto: parseFloat(d.pesoBruto), pesoLimpo: parseFloat(d.pesoLimpo), precoKgBruto: parseFloat(d.precoKgBruto), pesoAparas: parseFloat(d.pesoAparas || "0"), valorAparas: parseFloat(d.valorAparas || "0"), pesoDesperdicio: parseFloat(d.pesoDesperdicio || "0"), artigoId: parseInt(d.artigoId), artigoLimpoId: d.artigoLimpoId ? parseInt(d.artigoLimpoId) : undefined, criarMovimentos: true }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground mb-1 block">Proteína bruta *</label>
                  <select {...register("artigoId", { required: true })} className="w-full h-9 rounded-md bg-input border border-border text-sm px-3">
                    <option value="">— seleccionar —</option>
                    {artigos?.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Artigo limpo (opcional)</label>
                  <select {...register("artigoLimpoId")} className="w-full h-9 rounded-md bg-input border border-border text-sm px-3">
                    <option value="">— sem artigo limpo —</option>
                    {proteinas?.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Peso bruto (g) *</label>
                  <Input {...register("pesoBruto", { required: true })} type="number" step="0.1" className="bg-input border-border" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Peso limpo (g) *</label>
                  <Input {...register("pesoLimpo", { required: true })} type="number" step="0.1" className="bg-input border-border" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Preço/kg bruto (€) *</label>
                  <Input {...register("precoKgBruto", { required: true })} type="number" step="0.01" className="bg-input border-border" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Valor das aparas (€)</label>
                  <Input {...register("valorAparas")} type="number" step="0.01" defaultValue="0" className="bg-input border-border" /></div>
              </div>
              {pesoBruto > 0 && pesoLimpo > 0 && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-secondary rounded-lg">
                  <div className="text-center"><p className="text-xs text-muted-foreground">Aproveitamento</p><p className="font-display text-xl text-gold">{fmt(aproveitamento, 1)}%</p></div>
                  <div className="text-center"><p className="text-xs text-muted-foreground">Custo Real/kg</p><p className="font-display text-xl text-gold">{fmt(custoReal, 2)} €</p></div>
                  <div className="text-center"><p className="text-xs text-muted-foreground">Sobrecusto/kg</p><p className={`font-display text-xl ${custoReal - precoKg > 0 ? "text-warning" : "text-success"}`}>{fmt(custoReal - precoKg, 2)} €</p></div>
                </div>
              )}
              <Button type="submit" disabled={registar.isPending} className="w-full bg-primary text-primary-foreground">
                {registar.isPending ? "A registar…" : "Registar e Criar Movimentos de Transformação"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-card rounded animate-pulse" />)}</div>
        : (testes?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Ainda não há testes de rendimento. Regista o primeiro para calcular o custo real das proteínas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="border-b border-border bg-secondary/50">
                {["Proteína", "Bruto (g)", "Limpo (g)", "Aproveit.", "Preço/kg Bruto", "Custo Real/kg", "Sobrecusto", "Data"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {testes!.map(t => (
                  <tr key={t.id} className="border-b border-border hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-medium">{t.artigoNome}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(parseFloat(t.pesoBruto), 0)}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(parseFloat(t.pesoLimpo), 0)}</td>
                    <td className="px-4 py-2.5 font-mono text-gold">{fmt(parseFloat(t.aproveitamentoPct ?? "0"), 1)}%</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(parseFloat(t.precoKgBruto), 2)} €</td>
                    <td className="px-4 py-2.5 font-mono text-warning">{fmt(parseFloat(t.custoRealPorKg ?? "0"), 2)} €</td>
                    <td className="px-4 py-2.5 font-mono text-danger">+{fmt(parseFloat(t.sobrecusto ?? "0"), 2)} €</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd/MM/yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

