import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, TrendingUp, Pencil, Trash2, AlertTriangle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { toast } from "sonner";

function fmt(n: number | string | null | undefined, d = 4) {
  if (n == null) return "—";
  return parseFloat(String(n)).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function IngredienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "head_chef";
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.artigos.obter.useQuery({ id: parseInt(id!) });
  const { data: fornecedores } = trpc.fornecedores.listar.useQuery();

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [usoInfo, setUsoInfo] = useState<{ emUso: boolean; receitas: string[]; fichas: string[] } | null>(null);

  const atualizar = trpc.artigos.atualizar.useMutation({
    onSuccess: () => {
      toast.success("Ingrediente actualizado");
      utils.artigos.obter.invalidate({ id: parseInt(id!) });
      utils.artigos.listar.invalidate();
      setEditMode(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminar = trpc.artigos.eliminar.useMutation({
    onSuccess: () => {
      toast.success("Ingrediente desactivado");
      navigate("/ingredientes");
    },
    onError: (e) => toast.error(e.message),
  });

  const verificarUso = trpc.artigos.verificarUso.useQuery(
    { id: parseInt(id!) },
    { enabled: false }
  );

  async function handleDeleteClick() {
    const result = await verificarUso.refetch();
    const uso = result.data ?? { emUso: false, receitas: [], fichas: [] };
    setUsoInfo(uso);
    setShowDeleteDialog(true);
  }

  function startEdit() {
    if (!data) return;
    setEditData({
      nome: data.nome,
      categoria: data.categoria ?? "",
      unidadeBase: data.unidadeBase,
      unidadeCompra: data.unidadeCompra ?? "",
      fatorConversao: parseFloat(data.fatorConversao ?? "1"),
      stockMinimo: parseFloat(data.stockMinimo ?? "0"),
      fornecedorId: data.fornecedorId ?? null,
      prazoEntregaDias: data.prazoEntregaDias ?? 1,
      perecivel: data.perecivel ?? false,
      requerLimpeza: (data as any).requerLimpeza ?? false,
      tipoEtiqueta: (data as any).tipoEtiqueta ?? 'ambas',
    });
    setEditMode(true);
  }

  function handleSave() {
    atualizar.mutate({ id: parseInt(id!), ...editData });
  }

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
  if (!data) return <div className="p-6 text-muted-foreground">Artigo não encontrado.</div>;

  const historico = data.historicoCustos?.map((m: any) => ({
    data: format(new Date(m.dataMovimento), "dd/MM"),
    custo: parseFloat(m.custoUnitario) * 1000,
  })) ?? [];

  const isProteina = ["Peixe", "Carnes e Aves"].includes(editData.categoria ?? data.categoria ?? "");

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ingredientes")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-display text-3xl text-primary">{data.nome}</h1>
            <p className="text-muted-foreground text-sm">{data.categoria} · {data.tipo}</p>
          </div>
        </div>
        {canEdit && !editMode && (
          <div className="flex gap-2">
            <Button variant="outline" className="border-border gap-2" onClick={startEdit}>
              <Pencil className="w-4 h-4" /> Editar
            </Button>
            <Button variant="outline" className="border-danger text-danger hover:bg-danger/10 gap-2" onClick={handleDeleteClick}>
              <Trash2 className="w-4 h-4" /> Eliminar
            </Button>
          </div>
        )}
        {editMode && (
          <div className="flex gap-2">
            <Button variant="outline" className="border-border gap-2" onClick={() => setEditMode(false)}>
              <X className="w-4 h-4" /> Cancelar
            </Button>
            <Button className="bg-primary text-primary-foreground gap-2" onClick={handleSave} disabled={atualizar.isPending}>
              <Save className="w-4 h-4" /> {atualizar.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editMode ? (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg text-primary">Editar Ingrediente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
                <Input value={editData.nome ?? ""} onChange={e => setEditData(p => ({ ...p, nome: e.target.value }))} className="bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                <Input value={editData.categoria ?? ""} onChange={e => setEditData(p => ({ ...p, categoria: e.target.value }))} className="bg-input border-border" placeholder="ex: Peixe" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Unidade base *</label>
                <Select value={editData.unidadeBase} onValueChange={v => setEditData(p => ({ ...p, unidadeBase: v }))}>
                  <SelectTrigger className="bg-input border-border h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="g">g — gramas (sólidos)</SelectItem>
                    <SelectItem value="ml">ml — mililitros (líquidos)</SelectItem>
                    <SelectItem value="un">un — unidades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Unidade de compra</label>
                <Input value={editData.unidadeCompra ?? ""} onChange={e => setEditData(p => ({ ...p, unidadeCompra: e.target.value }))} className="bg-input border-border" placeholder="ex: kg" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fator de conversão</label>
                <Input type="number" step="0.001" value={editData.fatorConversao ?? 1} onChange={e => setEditData(p => ({ ...p, fatorConversao: parseFloat(e.target.value) }))} className="bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Stock mínimo</label>
                <Input type="number" step="0.001" value={editData.stockMinimo ?? 0} onChange={e => setEditData(p => ({ ...p, stockMinimo: parseFloat(e.target.value) }))} className="bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fornecedor</label>
                <Select value={editData.fornecedorId ? String(editData.fornecedorId) : "__none__"} onValueChange={v => setEditData(p => ({ ...p, fornecedorId: v === "__none__" ? null : parseInt(v) }))}>
                  <SelectTrigger className="bg-input border-border h-9"><SelectValue placeholder="— sem fornecedor —" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="__none__">— sem fornecedor —</SelectItem>
                    {fornecedores?.map((f: any) => <SelectItem key={f.id} value={String(f.id)}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prazo de entrega (dias)</label>
                <Input type="number" min="1" value={editData.prazoEntregaDias ?? 1} onChange={e => setEditData(p => ({ ...p, prazoEntregaDias: parseInt(e.target.value) }))} className="bg-input border-border" />
              </div>
              {isProteina && (
                <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 p-3 rounded-md bg-warning/5 border border-warning/20">
                  <Checkbox
                    id="requerLimpeza"
                    checked={!!editData.requerLimpeza}
                    onCheckedChange={v => setEditData(p => ({ ...p, requerLimpeza: !!v }))}
                    className="border-warning data-[state=checked]:bg-warning data-[state=checked]:border-warning"
                  />
                  <label htmlFor="requerLimpeza" className="text-sm cursor-pointer">
                    <span className="font-medium">Requer limpeza manual</span>
                    <span className="text-xs text-muted-foreground block">Aparece na lista do Rendimento de Proteínas</span>
                  </label>
                </div>
              )}
              {/* Tipo de etiqueta QR */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tipo de Etiqueta QR</label>
                <select
                  value={(editData as any).tipoEtiqueta ?? 'ambas'}
                  onChange={e => setEditData((p: any) => ({ ...p, tipoEtiqueta: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}
                >
                  <option value="ambas">Ambas (prateleira + produção)</option>
                  <option value="prateleira">Apenas prateleira (saída de stock)</option>
                  <option value="producao">Apenas produção (lote)</option>
                  <option value="nenhuma">Nenhuma</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Stats cards */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Stock Actual", value: `${parseFloat(String(data.stockAtual)).toFixed(2)} ${data.unidadeBase}`, highlight: true },
            { label: "Stock Mínimo", value: `${fmt(parseFloat(data.stockMinimo ?? "0"), 2)} ${data.unidadeBase}` },
            { label: "Custo Médio", value: `${fmt(parseFloat(data.custoMedioPonderado ?? "0") * 1000)} €/kg` },
            { label: "Valor em Stock", value: `${fmt(data.stockAtual * parseFloat(data.custoMedioPonderado ?? "0"), 2)} €` },
          ].map(({ label, value, highlight }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`font-display text-xl mt-1 ${highlight ? "text-primary" : ""}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info badges when not editing */}
      {!editMode && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-border text-muted-foreground">{data.unidadeBase}</Badge>
          {data.categoria && <Badge variant="outline" className="border-border text-muted-foreground">{data.categoria}</Badge>}
          {(data as any).fornecedorId && <Badge variant="outline" className="border-border text-muted-foreground">{fornecedores?.find((f: any) => f.id === (data as any).fornecedorId)?.nome ?? "Fornecedor"}</Badge>}
          {(data as any).requerLimpeza && <Badge className="bg-warning/20 text-warning border-warning/30">Requer limpeza</Badge>}
          {data.perecivel && <Badge className="bg-danger/20 text-danger border-danger/30">Perecível</Badge>}
        </div>
      )}

      {/* Price history chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Histórico de Preços de Compra
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há entradas de compra registadas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 280)" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: "oklch(0.55 0.008 80)" }} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.008 80)" }} tickFormatter={v => `${v}€`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.008 280)", border: "1px solid oklch(0.22 0.010 280)", borderRadius: "6px" }}
                  formatter={(v: number) => [`${v.toFixed(4)} €/kg`, "Preço"]}
                />
                <Line type="monotone" dataKey="custo" stroke="oklch(0.72 0.12 75)" strokeWidth={2} dot={{ fill: "oklch(0.72 0.12 75)" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className={`font-display text-xl flex items-center gap-2 ${usoInfo?.emUso ? "text-warning" : "text-danger"}`}>
              {usoInfo?.emUso ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              {usoInfo?.emUso ? "Ingrediente em uso" : "Eliminar Ingrediente"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {usoInfo?.emUso ? (
                  <>
                    <p className="text-muted-foreground text-sm">
                      O ingrediente <strong className="text-foreground">"{data.nome}"</strong> está a ser utilizado nas seguintes receitas/fichas e <strong className="text-warning">não pode ser eliminado</strong>:
                    </p>
                    {usoInfo.receitas.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Receitas Base</p>
                        <ul className="space-y-1">
                          {usoInfo.receitas.map((r, i) => (
                            <li key={i} className="text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {usoInfo.fichas.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fichas Técnicas</p>
                        <ul className="space-y-1">
                          {usoInfo.fichas.map((f, i) => (
                            <li key={i} className="text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Para eliminar este ingrediente, remove-o primeiro de todas as receitas e fichas técnicas listadas acima.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Tens a certeza que queres desactivar <strong className="text-foreground">"{data.nome}"</strong>?
                    O ingrediente ficará inactivo mas o histórico de movimentos será preservado.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              {usoInfo?.emUso ? "Fechar" : "Cancelar"}
            </AlertDialogCancel>
            {!usoInfo?.emUso && (
              <AlertDialogAction
                className="bg-danger text-white hover:bg-danger/90"
                onClick={() => eliminar.mutate({ id: parseInt(id!) })}
              >
                {eliminar.isPending ? "A eliminar…" : "Desactivar Ingrediente"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
