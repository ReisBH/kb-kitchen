import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Receipt, Upload, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function OcrFechoCaixa() {
  const [dados, setDados] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadImagem = trpc.upload.uploadImagem.useMutation();

  const processar = trpc.ocr.processarFechoCaixa.useMutation({
    onSuccess: (d) => { setDados(d.dadosExtraidos); toast.success("Fecho de caixa extraído. Revê antes de confirmar."); },
    onError: (e) => { toast.error(`Erro: ${e.message}`); setUploading(false); },
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
        <h1 className="font-display text-3xl text-gold">OCR — Fecho de Caixa</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Fotografa o mapa de vendas para processar automaticamente</p>
      </div>
      {!dados ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center space-y-4">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <p className="font-medium">Carrega o fecho de caixa</p>
            <p className="text-sm text-muted-foreground">O sistema extrai os pratos vendidos e faz a explosão de stock automaticamente</p>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading || processar.isPending}
              className="bg-primary text-primary-foreground gap-2">
              {(uploading || processar.isPending) ? <><Loader2 className="w-4 h-4 animate-spin" /> A processar…</> : <><Upload className="w-4 h-4" /> Seleccionar Ficheiro</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Vendas Extraídas — Revisão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm"><span className="text-muted-foreground">Data:</span> <span className="ml-2">{dados.data ?? "—"}</span></div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="border-b border-border bg-secondary/50">
                  {["Item POS", "Ficha Técnica", "Qtd", "Valor", "Confiança"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs text-muted-foreground">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(dados.linhas ?? []).map((l: any, i: number) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-3 py-2">{l.nomeItem}</td>
                      <td className="px-3 py-2">{l.fichaEmparelhada ? <span className="text-success">{l.fichaEmparelhada.nome}</span> : <span className="text-warning text-xs">Não emparelhado</span>}</td>
                      <td className="px-3 py-2 font-mono">{l.quantidade}</td>
                      <td className="px-3 py-2 font-mono">{l.valorTotal?.toFixed(2)} €</td>
                      <td className="px-3 py-2"><Badge className={`text-xs ${l.confianca === "alta" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{l.confianca}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" onClick={() => setDados(null)} className="border-border">Cancelar</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
