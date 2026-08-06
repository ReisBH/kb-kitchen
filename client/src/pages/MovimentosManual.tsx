import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function fmt(n: number | string, d = 4) {
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function MovimentosManual() {
  const [tab, setTab] = useState<"entrada" | "saida">("entrada");
  const [artigoId, setArtigoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [custo, setCusto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [filtro, setFiltro] = useState("");
  const utils = trpc.useUtils();

  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: "ingrediente" });

  const artFiltrados = artigos?.filter(a =>
    !filtro || a.nome.toLowerCase().includes(filtro.toLowerCase())
  ) ?? [];

  const entrada = trpc.movimentos.registarEntradaManual.useMutation({
    onSuccess: () => {
      toast.success("Entrada registada com sucesso.");
      setArtigoId(""); setQuantidade(""); setCusto(""); setMotivo("");
      utils.artigos.listar.invalidate();
      utils.movimentos.listar.invalidate();
      utils.dashboard.resumo.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const saida = trpc.movimentos.registarSaidaManual.useMutation({
    onSuccess: () => {
      toast.success("Saída registada com sucesso.");
      setArtigoId(""); setQuantidade(""); setMotivo("");
      utils.artigos.listar.invalidate();
      utils.movimentos.listar.invalidate();
      utils.dashboard.resumo.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const artigo = artigos?.find(a => a.id === parseInt(artigoId));

  function submeterEntrada() {
    if (!artigoId || !quantidade || !custo) { toast.error("Preenche todos os campos obrigatórios."); return; }
    const qtdNum = parseFloat(quantidade);
    const custoNum = parseFloat(custo);
    if (isNaN(qtdNum) || qtdNum <= 0) { toast.error("Quantidade inválida."); return; }
    if (isNaN(custoNum) || custoNum < 0) { toast.error("Custo inválido."); return; }
    // custo inserido em €/kg ou €/l → converter para €/unidadeBase
    const custoBase = artigo?.unidadeBase === "g" || artigo?.unidadeBase === "ml" ? custoNum / 1000 : custoNum;
    entrada.mutate({ artigoId: parseInt(artigoId), quantidade: qtdNum, custoUnitario: custoBase, motivo });
  }

  function submeterSaida() {
    if (!artigoId || !quantidade) { toast.error("Preenche todos os campos obrigatórios."); return; }
    const qtdNum = parseFloat(quantidade);
    if (isNaN(qtdNum) || qtdNum <= 0) { toast.error("Quantidade inválida."); return; }
    saida.mutate({ artigoId: parseInt(artigoId), quantidade: qtdNum, motivo });
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-3xl text-gold">Movimentos Manuais</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Regista entradas e saídas de stock sem OCR</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Tabs value={tab} onValueChange={v => { setTab(v as any); setArtigoId(""); setQuantidade(""); setCusto(""); setMotivo(""); }}>
              <TabsList className="w-full rounded-none border-b border-border bg-transparent h-12">
                <TabsTrigger value="entrada" className="flex-1 gap-2 data-[state=active]:text-gold data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
                  <ArrowDown className="w-4 h-4" /> Entrada de Stock
                </TabsTrigger>
                <TabsTrigger value="saida" className="flex-1 gap-2 data-[state=active]:text-gold data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
                  <ArrowUp className="w-4 h-4" /> Saída / Quebra
                </TabsTrigger>
              </TabsList>

              <TabsContent value="entrada" className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Ingrediente *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Pesquisar…" className="pl-9 bg-input border-border mb-2" />
                  </div>
                  <Select value={artigoId} onValueChange={v => { setArtigoId(v); setFiltro(""); }}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Seleccionar ingrediente…" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-60">
                      {artFiltrados.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.nome} <span className="text-muted-foreground text-xs ml-1">({a.unidadeBase})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Quantidade ({artigo?.unidadeBase ?? "unid."}) *</Label>
                    <Input value={quantidade} onChange={e => setQuantidade(e.target.value)} type="number" min="0" step="any" placeholder="0" className="bg-input border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço de compra (€/{artigo?.unidadeBase === "g" ? "kg" : artigo?.unidadeBase === "ml" ? "l" : artigo?.unidadeBase ?? "un"}) *</Label>
                    <Input value={custo} onChange={e => setCusto(e.target.value)} type="number" min="0" step="any" placeholder="0,00" className="bg-input border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo / Referência</Label>
                  <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="ex: Compra directa, Fatura nº 123…" className="bg-input border-border" />
                </div>
                {artigo && quantidade && custo && (
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo total entrada</span><span className="tabular-nums">{fmt(parseFloat(quantidade) * parseFloat(custo) / 1000, 2)} €</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo por {artigo.unidadeBase}</span><span className="tabular-nums text-gold">{fmt(parseFloat(custo) / 1000)} €/{artigo.unidadeBase}</span></div>
                  </div>
                )}
                <Button onClick={submeterEntrada} disabled={entrada.isPending} className="w-full bg-primary text-primary-foreground gap-2">
                  {entrada.isPending ? "A registar…" : <><ArrowDown className="w-4 h-4" /> Registar Entrada</>}
                </Button>
              </TabsContent>

              <TabsContent value="saida" className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Ingrediente *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Pesquisar…" className="pl-9 bg-input border-border mb-2" />
                  </div>
                  <Select value={artigoId} onValueChange={v => { setArtigoId(v); setFiltro(""); }}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Seleccionar ingrediente…" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-60">
                      {artFiltrados.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.nome} <span className="text-muted-foreground text-xs ml-1">({a.unidadeBase})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade ({artigo?.unidadeBase ?? "unid."}) *</Label>
                  <Input value={quantidade} onChange={e => setQuantidade(e.target.value)} type="number" min="0" step="any" placeholder="0" className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="ex: Quebra, Consumo interno, Devolução…" className="bg-input border-border" />
                </div>
                <Button onClick={submeterSaida} disabled={saida.isPending} className="w-full bg-danger/80 hover:bg-danger text-white gap-2">
                  {saida.isPending ? "A registar…" : <><ArrowUp className="w-4 h-4" /> Registar Saída</>}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Info panel */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Como usar</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground flex items-center gap-2"><ArrowDown className="w-4 h-4 text-success" /> Entrada de Stock</p>
              <p>Usa quando recebes mercadoria sem fatura em formato digital, ou quando queres corrigir o stock manualmente. O preço de compra actualiza o custo médio ponderado do ingrediente.</p>
              <p className="text-xs">O preço deve ser inserido em <strong>€/kg</strong> ou <strong>€/litro</strong> — o sistema converte automaticamente para €/g ou €/ml.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground flex items-center gap-2"><ArrowUp className="w-4 h-4 text-danger" /> Saída / Quebra</p>
              <p>Usa para registar perdas, quebras, devoluções ou consumos que não passam pelo registo de vendas. O custo é calculado automaticamente com base no custo médio ponderado actual.</p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs">Para entradas em massa via fatura, usa o módulo <strong>OCR — Faturas</strong>. Para vendas, usa <strong>Registo de Vendas</strong>.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

