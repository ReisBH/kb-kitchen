import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Receipt, Upload, CheckCircle, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function fmt(n: number, d = 2) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

type LinhaRevisao = {
  nomeItem: string;
  quantidade: number;
  valorTotal: number;
  confianca: string;
  fichaId?: number;
  fichaNome?: string;
  incluir: boolean;
};

export default function OcrFechoCaixa() {
  const [docId, setDocId] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [dataDoc, setDataDoc] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const uploadImagem = trpc.upload.uploadImagem.useMutation();
  const { data: fichas } = trpc.fichas.listar.useQuery();

  const processar = trpc.ocr.processarFechoCaixa.useMutation({
    onSuccess: (d) => {
      setDocId(d.docId);
      setDataDoc(d.dadosExtraidos?.data ?? "");
      const ls: LinhaRevisao[] = (d.dadosExtraidos?.linhas ?? []).map((l: any) => ({
        nomeItem: l.nomeItem,
        quantidade: l.quantidade ?? 1,
        valorTotal: l.valorTotal ?? 0,
        confianca: l.confianca ?? "baixa",
        fichaId: l.fichaEmparelhada?.id,
        fichaNome: l.fichaEmparelhada?.nome,
        incluir: !!l.fichaEmparelhada,
      }));
      setLinhas(ls);
      setUploading(false);
      toast.success("Fecho de caixa extraído. Revê e confirma as linhas.");
    },
    onError: (e) => { toast.error(`Erro: ${e.message}`); setUploading(false); },
  });

  const confirmar = trpc.ocr.confirmarFechoCaixa.useMutation({
    onSuccess: (d) => {
      toast.success(`Vendas confirmadas — Food Cost: ${fmt(d.foodCostPct, 1)}%${d.stockNegativo.length > 0 ? ` ⚠️ ${d.stockNegativo.join(", ")}` : ""}`);
      setDocId(null); setLinhas([]); setDataDoc("");
      utils.fichas.listarVendas.invalidate();
      utils.dashboard.resumo.invalidate();
      utils.artigos.listar.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        const { url, key } = await uploadImagem.mutateAsync({ base64, mimeType: file.type });
        processar.mutate({ imagemUrl: url, imagemKey: key });
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Erro ao carregar imagem");
      setUploading(false);
    }
  }

  function updateLinha(i: number, patch: Partial<LinhaRevisao>) {
    setLinhas(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  function submeter() {
    const linhasValidas = linhas.filter(l => l.incluir && l.fichaId && l.quantidade > 0);
    if (linhasValidas.length === 0) {
      toast.error("Nenhuma linha válida para confirmar. Verifica os emparelhamentos.");
      return;
    }
    confirmar.mutate({
      docId: docId!,
      linhas: linhasValidas.map(l => ({
        nomeItem: l.nomeItem,
        fichaId: l.fichaId!,
        quantidade: l.quantidade,
        valorTotal: l.valorTotal,
      })),
    });
  }

  const linhasValidas = linhas.filter(l => l.incluir && l.fichaId).length;
  const totalReceita = linhas.filter(l => l.incluir).reduce((s, l) => s + l.valorTotal, 0);

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-3xl text-gold">OCR — Fecho de Caixa</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Fotografa o mapa de vendas para processar automaticamente</p>
      </div>

      {linhas.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center space-y-4">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="font-medium">Carrega o fecho de caixa</p>
              <p className="text-sm text-muted-foreground mt-1">O sistema extrai os pratos vendidos, emparelha com fichas técnicas e apresenta uma ficha de revisão</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading || processar.isPending}
              className="bg-primary text-primary-foreground gap-2">
              {(uploading || processar.isPending)
                ? <><Loader2 className="w-4 h-4 animate-spin" /> A processar…</>
                : <><Upload className="w-4 h-4" /> Seleccionar Ficheiro</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Data:</span>
              <Input value={dataDoc} onChange={e => setDataDoc(e.target.value)} className="w-36 h-8 bg-input border-border" placeholder="YYYY-MM-DD" />
              <span className="text-muted-foreground ml-2">{linhasValidas} linha(s) válidas</span>
              <span className="text-gold font-medium tabular-nums">{fmt(totalReceita)} € receita</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setLinhas([]); setDocId(null); }} className="border-border gap-2">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button onClick={submeter} disabled={confirmar.isPending || linhasValidas === 0} className="bg-primary text-primary-foreground gap-2">
                {confirmar.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> A confirmar…</>
                  : <><CheckCircle className="w-4 h-4" /> Confirmar {linhasValidas} linha(s)</>}
              </Button>
            </div>
          </div>

          {/* Review table */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Ficha de Revisão — Edita antes de confirmar</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground w-8">✓</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Item no POS</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Ficha Técnica</th>
                      <th className="text-right px-4 py-2.5 text-xs text-muted-foreground">Qtd</th>
                      <th className="text-right px-4 py-2.5 text-xs text-muted-foreground">Valor Total</th>
                      <th className="text-center px-4 py-2.5 text-xs text-muted-foreground">Confiança</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i} className={`border-b border-border last:border-0 transition-opacity ${!l.incluir ? "opacity-40" : ""}`}>
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={l.incluir} onChange={e => updateLinha(i, { incluir: e.target.checked })}
                            className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                        </td>
                        <td className="px-4 py-2.5 font-medium">{l.nomeItem}</td>
                        <td className="px-4 py-2.5 min-w-[200px]">
                          <Select
                            value={l.fichaId ? String(l.fichaId) : ""}
                            onValueChange={v => {
                              const ficha = fichas?.find(f => f.id === parseInt(v));
                              updateLinha(i, { fichaId: parseInt(v), fichaNome: ficha?.nome, incluir: true });
                            }}
                          >
                            <SelectTrigger className="h-8 bg-input border-border text-xs">
                              <SelectValue placeholder="Seleccionar ficha…" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {fichas?.map(f => (
                                <SelectItem key={f.id} value={String(f.id)} className="text-xs">{f.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!l.fichaId && l.incluir && (
                            <p className="text-xs text-warning mt-1">Selecciona uma ficha técnica</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Input
                            type="number" min="0" step="1" value={l.quantidade}
                            onChange={e => updateLinha(i, { quantidade: parseFloat(e.target.value) || 0 })}
                            className="w-20 h-8 text-right bg-input border-border text-xs ml-auto tabular-nums"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Input
                            type="number" min="0" step="0.01" value={l.valorTotal}
                            onChange={e => updateLinha(i, { valorTotal: parseFloat(e.target.value) || 0 })}
                            className="w-24 h-8 text-right bg-input border-border text-xs ml-auto tabular-nums"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge className={`text-xs ${l.confianca === "alta" ? "bg-success/20 text-success" : l.confianca === "media" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}>
                            {l.confianca}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

