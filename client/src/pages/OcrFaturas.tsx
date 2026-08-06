import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { FileImage, Upload, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function OcrFaturas() {
  const [docId, setDocId] = useState<number | null>(null);
  const [dados, setDados] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const uploadImagem = trpc.upload.uploadImagem.useMutation();

  const processar = trpc.ocr.processarFatura.useMutation({
    onSuccess: (d) => { setDocId(d.docId); setDados(d.dadosExtraidos); toast.success("Fatura extraída. Revê as linhas antes de confirmar."); },
    onError: (e) => { toast.error(`Erro na extração: ${e.message}`); setUploading(false); },
  });

  const confirmar = trpc.ocr.confirmarFatura.useMutation({
    onSuccess: () => { toast.success("Fatura confirmada. Movimentos de stock registados."); setDocId(null); setDados(null); utils.movimentos.listar.invalidate(); },
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

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-3xl text-gold">OCR — Faturas de Fornecedor</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Fotografa ou carrega uma fatura para extração automática</p>
      </div>

      {!dados ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center space-y-4">
            <FileImage className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="font-medium">Carrega uma fatura</p>
              <p className="text-sm text-muted-foreground mt-1">JPG, PNG ou PDF · O sistema extrai automaticamente os artigos e preços</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading || processar.isPending}
              className="bg-primary text-primary-foreground gap-2">
              {(uploading || processar.isPending) ? <><Loader2 className="w-4 h-4 animate-spin" /> A processar…</> : <><Upload className="w-4 h-4" /> Seleccionar Ficheiro</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Dados Extraídos — Revisão Obrigatória</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Fornecedor:</span> <span className="ml-2">{dados.fornecedor ?? "—"}</span></div>
                <div><span className="text-muted-foreground">NIF:</span> <span className="ml-2">{dados.nif ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Número:</span> <span className="ml-2">{dados.numero ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="ml-2">{dados.data ?? "—"}</span></div>
              </div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm tabular-nums">
                  <thead><tr className="border-b border-border bg-secondary/50">
                    {["Descrição", "Artigo Emparelhado", "Qtd", "Unidade", "Preço Unit.", "Confiança"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs text-muted-foreground">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(dados.linhas ?? []).map((l: any, i: number) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-3 py-2">{l.descricao}</td>
                        <td className="px-3 py-2">{l.artigoEmparelhado ? <span className="text-success">{l.artigoEmparelhado.nome}</span> : <span className="text-warning text-xs">Não emparelhado</span>}</td>
                        <td className="px-3 py-2 font-mono">{l.quantidade}</td>
                        <td className="px-3 py-2">{l.unidade}</td>
                        <td className="px-3 py-2 font-mono">{l.precoUnitario?.toFixed(4)} €</td>
                        <td className="px-3 py-2"><Badge className={`text-xs ${l.confianca === "alta" ? "bg-success/20 text-success" : l.confianca === "media" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}>{l.confianca}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => { setDados(null); setDocId(null); }} className="border-border">Cancelar</Button>
                <Button className="bg-primary text-primary-foreground gap-2" disabled={confirmar.isPending}
                  onClick={() => confirmar.mutate({
                    docId: docId!,
                    linhas: (dados.linhas ?? []).filter((l: any) => l.artigoEmparelhado).map((l: any) => ({
                      descricao: l.descricao, artigoId: l.artigoEmparelhado.id,
                      quantidade: l.quantidade, unidade: l.unidade, precoUnitario: l.precoUnitario ?? 0, guardarAlias: true,
                    })),
                  })}>
                  {confirmar.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> A confirmar…</> : <><CheckCircle className="w-4 h-4" /> Confirmar e Registar Stock</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
