import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { FileImage, Upload, CheckCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type LinhaRevisao = {
  descricao: string;
  artigoId?: number;
  artigoNome?: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  confianca: string;
  incluir: boolean;
};

export default function OcrFaturas() {
  const [docId, setDocId] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [metaDados, setMetaDados] = useState<{ fornecedor?: string; nif?: string; numero?: string; data?: string }>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const uploadImagem = trpc.upload.uploadImagem.useMutation();
  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: "ingrediente" });

  const processar = trpc.ocr.processarFatura.useMutation({
    onSuccess: (d) => {
      setDocId(d.docId);
      setMetaDados({
        fornecedor: d.dadosExtraidos?.fornecedor,
        nif: d.dadosExtraidos?.nif,
        numero: d.dadosExtraidos?.numero,
        data: d.dadosExtraidos?.data,
      });
      const ls: LinhaRevisao[] = (d.dadosExtraidos?.linhas ?? []).map((l: any) => ({
        descricao: l.descricao,
        artigoId: l.artigoEmparelhado?.id,
        artigoNome: l.artigoEmparelhado?.nome,
        quantidade: l.quantidade ?? 0,
        unidade: l.unidade ?? "kg",
        precoUnitario: l.precoUnitario ?? 0,
        confianca: l.confianca ?? "baixa",
        incluir: !!l.artigoEmparelhado,
      }));
      setLinhas(ls);
      setUploading(false);
      toast.success("Fatura extraída. Revê e corrige as linhas antes de confirmar.");
    },
    onError: (e) => { toast.error(`Erro na extração: ${e.message}`); setUploading(false); },
  });

  const confirmar = trpc.ocr.confirmarFatura.useMutation({
    onSuccess: () => {
      toast.success("Fatura confirmada. Movimentos de stock registados.");
      setDocId(null); setLinhas([]); setMetaDados({});
      utils.movimentos.listar.invalidate();
      utils.artigos.listar.invalidate();
      utils.dashboard.resumo.invalidate();
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
    const linhasValidas = linhas.filter(l => l.incluir && l.artigoId && l.quantidade > 0 && l.precoUnitario >= 0);
    if (linhasValidas.length === 0) {
      toast.error("Nenhuma linha válida. Verifica os emparelhamentos e quantidades.");
      return;
    }
    confirmar.mutate({
      docId: docId!,
      linhas: linhasValidas.map(l => ({
        descricao: l.descricao,
        artigoId: l.artigoId!,
        quantidade: l.quantidade,
        unidade: l.unidade,
        precoUnitario: l.precoUnitario,
        guardarAlias: true,
      })),
    });
  }

  const linhasValidas = linhas.filter(l => l.incluir && l.artigoId).length;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-3xl text-gold">OCR — Faturas de Fornecedor</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Fotografa ou carrega uma fatura para extração automática</p>
      </div>

      {linhas.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center space-y-4">
            <FileImage className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="font-medium">Carrega uma fatura</p>
              <p className="text-sm text-muted-foreground mt-1">JPG, PNG ou PDF · O sistema extrai artigos e preços e apresenta uma ficha de revisão editável</p>
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
          {/* Meta header */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: "Fornecedor", key: "fornecedor" as const },
                  { label: "NIF", key: "nif" as const },
                  { label: "Nº Documento", key: "numero" as const },
                  { label: "Data", key: "data" as const },
                ].map(({ label, key }) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <Input
                      value={metaDados[key] ?? ""}
                      onChange={e => setMetaDados(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-8 bg-input border-border text-sm"
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">{linhasValidas} linha(s) válidas para importar</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setLinhas([]); setDocId(null); setMetaDados({}); }} className="border-border gap-2">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button onClick={submeter} disabled={confirmar.isPending || linhasValidas === 0} className="bg-primary text-primary-foreground gap-2">
                {confirmar.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> A confirmar…</>
                  : <><CheckCircle className="w-4 h-4" /> Confirmar {linhasValidas} linha(s)</>}
              </Button>
            </div>
          </div>

          {/* Editable review table */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Ficha de Revisão — Edita antes de confirmar</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-3 py-2.5 text-xs text-muted-foreground w-8">✓</th>
                      <th className="text-left px-3 py-2.5 text-xs text-muted-foreground">Descrição na Fatura</th>
                      <th className="text-left px-3 py-2.5 text-xs text-muted-foreground min-w-[180px]">Artigo no Stock</th>
                      <th className="text-right px-3 py-2.5 text-xs text-muted-foreground">Qtd</th>
                      <th className="text-left px-3 py-2.5 text-xs text-muted-foreground w-20">Unid.</th>
                      <th className="text-right px-3 py-2.5 text-xs text-muted-foreground">Preço Unit. (€)</th>
                      <th className="text-center px-3 py-2.5 text-xs text-muted-foreground">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i} className={`border-b border-border last:border-0 transition-opacity ${!l.incluir ? "opacity-40" : ""}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={l.incluir} onChange={e => updateLinha(i, { incluir: e.target.checked })}
                            className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] truncate" title={l.descricao}>{l.descricao}</td>
                        <td className="px-3 py-2">
                          <Select
                            value={l.artigoId ? String(l.artigoId) : ""}
                            onValueChange={v => {
                              const art = artigos?.find(a => a.id === parseInt(v));
                              updateLinha(i, { artigoId: parseInt(v), artigoNome: art?.nome, incluir: true });
                            }}
                          >
                            <SelectTrigger className="h-8 bg-input border-border text-xs">
                              <SelectValue placeholder="Seleccionar artigo…" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border max-h-52">
                              {artigos?.map(a => (
                                <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!l.artigoId && l.incluir && <p className="text-xs text-warning mt-0.5">Selecciona um artigo</p>}
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="any" value={l.quantidade}
                            onChange={e => updateLinha(i, { quantidade: parseFloat(e.target.value) || 0 })}
                            className="w-20 h-8 text-right bg-input border-border text-xs ml-auto tabular-nums" />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={l.unidade} onChange={e => updateLinha(i, { unidade: e.target.value })}
                            className="w-16 h-8 bg-input border-border text-xs tabular-nums" placeholder="kg" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="any" value={l.precoUnitario}
                            onChange={e => updateLinha(i, { precoUnitario: parseFloat(e.target.value) || 0 })}
                            className="w-24 h-8 text-right bg-input border-border text-xs ml-auto tabular-nums" />
                        </td>
                        <td className="px-3 py-2 text-center">
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
