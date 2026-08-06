import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function fmt(n: number | string | null | undefined, d = 2) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function FichasTecnicas() {
  const { data: fichas, isLoading } = trpc.fichas.listar.useQuery();
  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-gold">Fichas Técnicas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{fichas?.length ?? 0} fichas activas</p></div>
        <Button className="bg-primary text-primary-foreground gap-2" onClick={() => toast.info("Criação de fichas técnicas em breve.")}>
          <Plus className="w-4 h-4" /> Nova Ficha
        </Button>
      </div>
      {isLoading ? <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div>
        : (fichas?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Ainda não há fichas técnicas. Cria a primeira a partir dos ingredientes que já tens.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="border-b border-border bg-secondary/50">
                {["Prato", "Secção", "Custo/Dose", "Preço Venda", "Food Cost", "Margem", "Estado"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {fichas!.map(f => {
                  const custo = f.custoCalculado ?? 0;
                  const preco = parseFloat(f.precoVenda ?? "0");
                  const margem = preco - custo;
                  const fc = f.foodCostPct ?? null;
                  const fcAlvo = parseFloat(f.foodCostAlvo ?? "30");
                  return (
                    <tr key={f.id} className="border-b border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <Link href={`/fichas/${f.id}`}>
                          <span className="hover:text-gold cursor-pointer font-medium transition-colors">{f.nome}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{f.secaoMenu ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">{fmt(custo, 2)} €</td>
                      <td className="px-4 py-3 font-mono text-gold">{fmt(preco)} €</td>
                      <td className={cn("px-4 py-3 font-mono font-medium", fc != null && fc > fcAlvo ? "text-danger" : fc != null ? "text-success" : "")}>
                        {fc != null ? `${fmt(fc, 1)}%` : "—"}
                      </td>
                      <td className={cn("px-4 py-3 font-mono", margem > 0 ? "text-success" : "text-danger")}>{fmt(margem)} €</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${f.ativo ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}>
                          {f.ativo ? "Activa" : "Inactiva"}
                        </Badge>
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
