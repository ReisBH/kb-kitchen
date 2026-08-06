import { trpc } from "@/lib/trpc";
import { Bell, Package, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

function fmt(n: number | string, d = 2) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Alertas() {
  const utils = trpc.useUtils();
  const { data: alertas, isLoading } = trpc.alertas.verificar.useQuery();
  const { data: notas } = trpc.alertas.listarNotasEncomenda.useQuery();
  const gerarNotas = trpc.alertas.gerarNotasEncomenda.useMutation({
    onSuccess: (d) => { toast.success(`${d.notasCriadas.length} nota(s) de encomenda criadas`); utils.alertas.listarNotasEncomenda.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const enviarNota = trpc.alertas.aprovarEEnviarNota.useMutation({
    onSuccess: () => { toast.success("Nota de encomenda enviada ao proprietário"); utils.alertas.listarNotasEncomenda.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const notificar = trpc.alertas.enviarNotificacaoProprietario.useMutation({
    onSuccess: () => toast.success("Notificação enviada ao proprietário"),
    onError: (e) => toast.error(e.message),
  });

  const totalProblemas = (alertas?.abaixoMinimo?.length ?? 0) + (alertas?.stockNegativo?.length ?? 0);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-3xl text-gold">Alertas e Encomendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{totalProblemas} artigos a requerer atenção</p></div>
        <div className="flex gap-2">
          {(alertas?.abaixoMinimo?.length ?? 0) > 0 && (
            <Button variant="outline" className="border-warning/50 text-warning gap-2"
              onClick={() => notificar.mutate({ artigoIds: alertas!.abaixoMinimo.map(a => a.id) })}
              disabled={notificar.isPending}>
              <Bell className="w-4 h-4" /> Notificar Proprietário
            </Button>
          )}
          <Button className="bg-primary text-primary-foreground gap-2"
            onClick={() => gerarNotas.mutate()} disabled={gerarNotas.isPending}>
            <Package className="w-4 h-4" /> {gerarNotas.isPending ? "A gerar…" : "Gerar Notas de Encomenda"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Abaixo do mínimo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning" /> Abaixo do Mínimo ({alertas?.abaixoMinimo?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(alertas?.abaixoMinimo?.length ?? 0) === 0 ? (
              <p className="text-sm text-success flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Tudo em ordem.</p>
            ) : (
              <div className="space-y-2">
                {alertas!.abaixoMinimo.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                    <span>{a.nome}</span>
                    <div className="text-right tabular-nums">
                      <span className="text-warning">{fmt(a.stockAtual)} {a.unidadeBase}</span>
                      <span className="text-muted-foreground text-xs ml-2">/ mín {fmt(parseFloat(a.stockMinimo ?? "0"))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock negativo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger" /> Stock Negativo ({alertas?.stockNegativo?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(alertas?.stockNegativo?.length ?? 0) === 0 ? (
              <p className="text-sm text-success flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Sem stock negativo.</p>
            ) : (
              <div className="space-y-2">
                {alertas!.stockNegativo.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                    <span>{a.nome}</span>
                    <span className="text-danger tabular-nums">{fmt(a.stockAtual)} {a.unidadeBase}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notas de encomenda */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Notas de Encomenda</CardTitle>
        </CardHeader>
        <CardContent>
          {(notas?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há notas de encomenda. Clica em "Gerar Notas de Encomenda" para criar automaticamente.</p>
          ) : (
            <div className="space-y-2">
              {notas!.map(n => (
                <div key={n.nota.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{n.nota.numero}</p>
                    <p className="text-xs text-muted-foreground">{n.fornecedorNome} · {format(new Date(n.nota.createdAt), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${n.nota.estado === "enviada" ? "bg-success/20 text-success" : n.nota.estado === "recebida" ? "bg-info/20 text-info" : "bg-warning/20 text-warning"}`}>
                      {n.nota.estado}
                    </Badge>
                    {n.nota.estado === "rascunho" && (
                      <Button size="sm" className="bg-primary text-primary-foreground gap-1 h-7 text-xs"
                        onClick={() => enviarNota.mutate({ id: n.nota.id })} disabled={enviarNota.isPending}>
                        <Send className="w-3 h-3" /> Enviar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

