import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function MapaPos() {
  const utils = trpc.useUtils();
  const { data: mapas, isLoading } = trpc.ocr.listarMapaPos.useQuery();
  const { data: fichas } = trpc.fichas.listar.useQuery({ apenasPublicadas: true });
  const [nomePos, setNomePos] = useState("");
  const [fichaId, setFichaId] = useState("");
  const guardar = trpc.ocr.guardarMapaPos.useMutation({
    onSuccess: () => { toast.success("Mapa POS guardado."); utils.ocr.listarMapaPos.invalidate(); setNomePos(""); setFichaId(""); },
    onError: (erro) => toast.error(erro.message),
  });
  const submeter = () => {
    if (!nomePos.trim() || !fichaId) return toast.error("Indica o nome do item no POS e a ficha técnica correspondente.");
    guardar.mutate({ nomePos: nomePos.trim(), fichaId: Number(fichaId) });
  };
  return <div className="space-y-6 animate-in"><div><h1 className="font-display text-3xl text-gold">Mapa POS</h1><p className="text-muted-foreground text-sm mt-1">Associa nomes do ponto de venda às fichas técnicas para automatizar o fecho de caixa.</p><p className="text-xs text-warning mt-2">Só fichas técnicas publicadas podem ser mapeadas e processadas pelo POS.</p></div><Card className="bg-card border-border"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4 text-gold" /> Nova associação</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end"><div><label className="text-xs text-muted-foreground mb-1 block">Nome no POS</label><Input value={nomePos} onChange={(e) => setNomePos(e.target.value)} placeholder="Ex.: Menu almoço" className="bg-input border-border" /></div><div><label className="text-xs text-muted-foreground mb-1 block">Ficha técnica publicada</label><select value={fichaId} onChange={(e) => setFichaId(e.target.value)} className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm"><option value="">— seleccionar ficha —</option>{(fichas ?? []).map((ficha) => <option key={ficha.id} value={ficha.id}>{ficha.nome}</option>)}</select></div><Button className="bg-primary text-primary-foreground gap-2" disabled={guardar.isPending} onClick={submeter}><Save className="w-4 h-4" /> {guardar.isPending ? "A guardar…" : "Guardar e validar"}</Button></CardContent></Card><Card className="bg-card border-border"><CardHeader><CardTitle className="text-base">Associações existentes</CardTitle></CardHeader><CardContent>{isLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded animate-pulse" />)}</div> : (mapas?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Ainda não há associações POS configuradas.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wide">Item no POS</th><th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wide">Ficha técnica</th><th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wide">Validação</th></tr></thead><tbody>{mapas!.map(({ mapa, fichaNome, fichaEstadoPublicacao }) => <tr key={mapa.id} className="border-b border-border/60"><td className="py-2.5 font-medium">{mapa.nomePos}</td><td className="py-2.5 text-gold">{fichaNome ?? "Ficha removida"}</td><td className="py-2.5 text-xs">{mapa.ativo && fichaEstadoPublicacao === "publicada" ? <span className="text-success">Validado</span> : <span className="text-warning">Pendente</span>}</td></tr>)}</tbody></table></div>}</CardContent></Card></div>;
}
