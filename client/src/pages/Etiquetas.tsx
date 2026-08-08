import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { QrCode, Printer, Plus, Trash2, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';

// ── QR Code display using a simple SVG approach via qrcode library ────────────
function QrImg({ url, size = 120 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  // Generate QR on mount via dynamic import
  useState(() => {
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(url, { errorCorrectionLevel: 'Q', margin: 2, width: size })
        .then(setSrc).catch(() => {});
    });
  });
  if (!src) return <div className="bg-gray-800 rounded" style={{ width: size, height: size }} />;
  return <img src={src} alt="QR Code" style={{ width: size, height: size }} />;
}

// ── Print shelf labels ────────────────────────────────────────────────────────
function imprimirEtiquetasPrateleira(artigos: any[], baseUrl: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Etiquetas de Prateleira — KB Kitchen</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { margin: 0; font-family: Arial, sans-serif; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
    .label { border: 1px solid #333; border-radius: 4mm; padding: 4mm; text-align: center; break-inside: avoid; }
    .nome { font-size: 11pt; font-weight: bold; margin: 2mm 0 1mm; }
    .codigo { font-size: 7pt; color: #666; }
    .unidade { font-size: 8pt; color: #444; }
    img { display: block; margin: 0 auto; }
  </style></head><body>
  <div class="grid">
    ${artigos.map(a => `
      <div class="label">
        <img src="${baseUrl}/api/qr-img?url=${encodeURIComponent(`${window.location.origin}/s/${a.codigoCurto}`)}&size=100" width="100" height="100" />
        <div class="nome">${a.nome}</div>
        <div class="unidade">${a.unidadeBase}</div>
        <div class="codigo">${a.codigoCurto}</div>
      </div>
    `).join('')}
  </div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Etiquetas() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'prateleira' | 'lotes' | 'validade' | 'regras'>('prateleira');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [novoLote, setNovoLote] = useState({ artigoId: '', quantidade: '', unidade: 'g', metodo: 'refrigerado' as const, notas: '' });

  const { data: artigos } = trpc.artigos.listar.useQuery({ tipo: 'ingrediente' });
  const { data: lotes, refetch: refetchLotes } = trpc.qr.listarLotes.useQuery({ estado: 'ativo' });
  const { data: alertas } = trpc.qr.alertasValidade.useQuery();
  const { data: regras, refetch: refetchRegras } = trpc.qr.listarRegrasValidade.useQuery();

  const gerarCodigo = trpc.qr.gerarCodigoCurto.useMutation();
  const criarLote = trpc.qr.criarLote.useMutation();
  const eliminarRegra = trpc.qr.eliminarRegraValidade.useMutation();
  const criarRegra = trpc.qr.criarRegraValidade.useMutation();

  const [novaRegra, setNovaRegra] = useState({ artigoId: '', metodo: 'refrigerado' as const, dias: '' });

  const artigosFiltrados = (artigos ?? []).filter(a =>
    !filtroCategoria || a.categoria === filtroCategoria
  );
  const categorias = Array.from(new Set((artigos ?? []).map(a => a.categoria).filter(Boolean))).sort() as string[];

  const handleGerarCodigos = async () => {
    const semCodigo = Array.from(selected).filter(id => !(artigos ?? []).find(a => a.id === id)?.codigoCurto);
    for (const id of semCodigo) {
      await gerarCodigo.mutateAsync({ artigoId: id });
    }
    toast.success(`${semCodigo.length} códigos gerados`);
  };

  const handleImprimir = () => {
    const selecionados = (artigos ?? []).filter(a => selected.has(a.id) && a.codigoCurto);
    if (!selecionados.length) { toast.error('Selecciona artigos com código QR gerado'); return; }
    imprimirEtiquetasPrateleira(selecionados, window.location.origin);
  };

  const handleCriarLote = () => {
    if (!novoLote.artigoId || !novoLote.quantidade) return;
    criarLote.mutate({
      artigoId: Number(novoLote.artigoId),
      quantidadeProduzida: Number(novoLote.quantidade),
      unidade: novoLote.unidade,
      metodoConservacao: novoLote.metodo,
      notas: novoLote.notas || undefined,
    }, {
      onSuccess: (lote) => {
        toast.success(`Lote ${lote?.codigoLote} criado`);
        refetchLotes();
        setNovoLote({ artigoId: '', quantidade: '', unidade: 'g', metodo: 'refrigerado', notas: '' });
        // Open print dialog for the new label
        if (lote) imprimirEtiquetaProducao(lote, (artigos ?? []).find(a => a.id === lote.artigoId)?.nome ?? '');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleCriarRegra = () => {
    if (!novaRegra.artigoId || !novaRegra.dias) return;
    criarRegra.mutate({
      artigoId: Number(novaRegra.artigoId),
      metodoConservacao: novaRegra.metodo,
      diasValidade: Number(novaRegra.dias),
    }, {
      onSuccess: () => { toast.success('Regra criada'); refetchRegras(); setNovaRegra({ artigoId: '', metodo: 'refrigerado', dias: '' }); },
      onError: (err) => toast.error(err.message),
    });
  };

  const diasCor = (d: number | null) => d === null ? '#9ca3af' : d < 0 ? '#ef4444' : d <= 1 ? '#f59e0b' : '#22c55e';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <QrCode className="w-7 h-7" style={{ color: '#D4AF37' }} />
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#D4AF37' }}>QR Codes e Etiquetas</h1>
          <p className="text-sm text-gray-400">Gestão de etiquetas de prateleira e lotes de produção</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'prateleira', label: 'Etiquetas de Prateleira' },
          { key: 'lotes', label: 'Lotes de Produção' },
          { key: 'validade', label: `Alertas de Validade${(alertas?.expirados?.length ?? 0) + (alertas?.aExpirar48h?.length ?? 0) > 0 ? ` (${(alertas?.expirados?.length ?? 0) + (alertas?.aExpirar48h?.length ?? 0)})` : ''}` },
          { key: 'regras', label: 'Regras de Validade' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: tab === t.key ? '#D4AF37' : 'rgba(212,175,55,0.1)', color: tab === t.key ? '#000' : '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Shelf labels tab ── */}
      {tab === 'prateleira' && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}>
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c!}>{c}</option>)}
            </select>
            <button onClick={() => setSelected(new Set(artigosFiltrados.map(a => a.id)))}
              className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
              Seleccionar todos
            </button>
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
              Limpar
            </button>
            {selected.size > 0 && (
              <>
                <button onClick={handleGerarCodigos}
                  className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.4)' }}>
                  Gerar QR ({selected.size})
                </button>
                <button onClick={handleImprimir}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ background: '#D4AF37', color: '#000' }}>
                  <Printer className="w-4 h-4" /> Imprimir ({selected.size})
                </button>
              </>
            )}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(212,175,55,0.2)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(212,175,55,0.1)' }}>
                  <th className="p-3 text-left w-8"><input type="checkbox" onChange={e => e.target.checked ? setSelected(new Set(artigosFiltrados.map(a => a.id))) : setSelected(new Set())} /></th>
                  <th className="p-3 text-left" style={{ color: '#D4AF37' }}>Artigo</th>
                  <th className="p-3 text-left" style={{ color: '#D4AF37' }}>Categoria</th>
                  <th className="p-3 text-left" style={{ color: '#D4AF37' }}>Unid.</th>
                  <th className="p-3 text-left" style={{ color: '#D4AF37' }}>Código QR</th>
                  <th className="p-3 text-left" style={{ color: '#D4AF37' }}>URL</th>
                </tr>
              </thead>
              <tbody>
                {artigosFiltrados.map(a => (
                  <tr key={a.id} className="border-t" style={{ borderColor: 'rgba(212,175,55,0.1)' }}>
                    <td className="p-3"><input type="checkbox" checked={selected.has(a.id)} onChange={e => {
                      const s = new Set(selected);
                      e.target.checked ? s.add(a.id) : s.delete(a.id);
                      setSelected(s);
                    }} /></td>
                    <td className="p-3 font-medium text-white">{a.nome}</td>
                    <td className="p-3 text-gray-400">{a.categoria}</td>
                    <td className="p-3 text-gray-400">{a.unidadeBase}</td>
                    <td className="p-3">
                      {a.codigoCurto ? (
                        <span className="font-mono text-xs px-2 py-1 rounded" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>{a.codigoCurto}</span>
                      ) : (
                        <span className="text-gray-600 text-xs">sem código</span>
                      )}
                    </td>
                    <td className="p-3">
                      {a.codigoCurto && (
                        <a href={`/s/${a.codigoCurto}`} target="_blank" className="text-xs underline" style={{ color: '#D4AF37' }}>/s/{a.codigoCurto}</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Lots tab ── */}
      {tab === 'lotes' && (
        <div>
          <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)' }}>
            <h3 className="font-semibold mb-3" style={{ color: '#D4AF37' }}>Criar novo lote</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select value={novoLote.artigoId} onChange={e => setNovoLote(l => ({ ...l, artigoId: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm col-span-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}>
                <option value="">Seleccionar artigo...</option>
                {(artigos ?? []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <input value={novoLote.quantidade} onChange={e => setNovoLote(l => ({ ...l, quantidade: e.target.value }))}
                placeholder="Quantidade" type="number"
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#fff' }} />
              <select value={novoLote.metodo} onChange={e => setNovoLote(l => ({ ...l, metodo: e.target.value as any }))}
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}>
                <option value="refrigerado">Refrigerado</option>
                <option value="congelado">Congelado</option>
                <option value="vacuo">Vácuo</option>
                <option value="ambiente">Ambiente</option>
              </select>
              <input value={novoLote.notas} onChange={e => setNovoLote(l => ({ ...l, notas: e.target.value }))}
                placeholder="Notas (opcional)" className="rounded-lg px-3 py-2 text-sm col-span-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#fff' }} />
            </div>
            <button onClick={handleCriarLote} disabled={criarLote.isPending || !novoLote.artigoId || !novoLote.quantidade}
              className="px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
              style={{ background: '#D4AF37', color: '#000' }}>
              <Plus className="w-4 h-4" /> {criarLote.isPending ? 'A criar...' : 'Criar lote e imprimir etiqueta'}
            </button>
          </div>

          <div className="space-y-2">
            {(lotes ?? []).map(l => (
              <div key={l.id} className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.15)' }}>
                <div>
                  <p className="font-medium text-white">{l.nomeProduto}</p>
                  <p className="text-xs text-gray-400 font-mono">{l.codigoLote} · {Number(l.quantidadeRestante).toFixed(1)} {l.unidade} · {l.metodoConservacao}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: diasCor(l.diasRestantes) }}>
                    {l.diasRestantes === null ? '—' : l.diasRestantes < 0 ? 'Expirado' : `${l.diasRestantes}d`}
                  </p>
                  <a href={`/l/${l.codigoLote}`} className="text-xs underline" style={{ color: '#D4AF37' }}>Ver lote</a>
                </div>
              </div>
            ))}
            {(lotes ?? []).length === 0 && <p className="text-gray-500 text-sm text-center py-8">Nenhum lote activo.</p>}
          </div>
        </div>
      )}

      {/* ── Validity alerts tab ── */}
      {tab === 'validade' && (
        <div className="space-y-6">
          {(alertas?.expirados?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Expirados ({alertas!.expirados.length})</h3>
              <div className="space-y-2">
                {alertas!.expirados.map((l: any) => (
                  <div key={l.id} className="rounded-xl p-3 flex justify-between items-center"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <div>
                      <p className="font-medium text-white">{l.nomeProduto}</p>
                      <p className="text-xs text-gray-400">{l.codigoLote} · {Number(l.quantidadeRestante).toFixed(1)} {l.unidade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-bold text-sm">{l.dataValidade ? new Date(l.dataValidade).toLocaleDateString('pt-PT') : '—'}</p>
                      <a href={`/l/${l.codigoLote}`} className="text-xs underline text-red-400">Descartar</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(alertas?.aExpirar48h?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> A expirar em 48h ({alertas!.aExpirar48h.length})</h3>
              <div className="space-y-2">
                {alertas!.aExpirar48h.map((l: any) => (
                  <div key={l.id} className="rounded-xl p-3 flex justify-between items-center"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <div>
                      <p className="font-medium text-white">{l.nomeProduto}</p>
                      <p className="text-xs text-gray-400">{l.codigoLote} · {Number(l.quantidadeRestante).toFixed(1)} {l.unidade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-bold text-sm">{l.diasRestantes}d</p>
                      <p className="text-xs text-gray-400">{l.dataValidade ? new Date(l.dataValidade).toLocaleDateString('pt-PT') : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(alertas?.expirados?.length ?? 0) === 0 && (alertas?.aExpirar48h?.length ?? 0) === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#22c55e' }} />
              <p className="text-gray-400">Nenhum lote a expirar nas próximas 48 horas.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Validity rules tab ── */}
      {tab === 'regras' && (
        <div>
          {(user?.role === 'admin' || user?.role === 'head_chef') && (
            <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <h3 className="font-semibold mb-3" style={{ color: '#D4AF37' }}>Nova regra de validade</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <select value={novaRegra.artigoId} onChange={e => setNovaRegra(r => ({ ...r, artigoId: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}>
                  <option value="">Artigo...</option>
                  {(artigos ?? []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
                <select value={novaRegra.metodo} onChange={e => setNovaRegra(r => ({ ...r, metodo: e.target.value as any }))}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}>
                  <option value="refrigerado">Refrigerado</option>
                  <option value="congelado">Congelado</option>
                  <option value="vacuo">Vácuo</option>
                  <option value="ambiente">Ambiente</option>
                </select>
                <input value={novaRegra.dias} onChange={e => setNovaRegra(r => ({ ...r, dias: e.target.value }))}
                  placeholder="Dias" type="number" min="1"
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#fff' }} />
              </div>
              <button onClick={handleCriarRegra}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{ background: '#D4AF37', color: '#000' }}>
                <Plus className="w-4 h-4" /> Criar regra
              </button>
            </div>
          )}
          <div className="space-y-2">
            {(regras ?? []).map((r: any) => (
              <div key={r.id} className="rounded-xl p-3 flex justify-between items-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.15)' }}>
                <div>
                  <p className="font-medium text-white">{r.nomeArtigo ?? 'Artigo desconhecido'}</p>
                  <p className="text-xs text-gray-400 capitalize">{r.metodoConservacao} · {r.diasValidade} dias</p>
                </div>
                {(user?.role === 'admin' || user?.role === 'head_chef') && (
                  <button onClick={() => eliminarRegra.mutate({ id: r.id }, { onSuccess: () => refetchRegras() })}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-400/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {(regras ?? []).length === 0 && <p className="text-gray-500 text-sm text-center py-8">Nenhuma regra de validade definida.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function imprimirEtiquetaProducao(lote: any, nomeProduto: string) {
  const url = `${window.location.origin}/l/${lote.codigoLote}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Etiqueta de Produção — ${nomeProduto}</title>
  <style>
    @page { size: 62mm 50mm; margin: 2mm; }
    body { margin: 0; font-family: Arial, sans-serif; font-size: 8pt; }
    .label { width: 58mm; padding: 2mm; }
    .nome { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 2mm; }
    .row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
    .label-txt { color: #666; font-size: 7pt; }
    .val { font-weight: bold; }
    .val-date { font-size: 10pt; font-weight: bold; }
    .qr { text-align: center; margin: 2mm 0; }
    .metodo { text-align: center; font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 1mm; }
    .footer { display: flex; justify-content: space-between; font-size: 6pt; color: #888; margin-top: 1mm; }
    .warn { color: #c00; font-weight: bold; text-align: center; font-size: 7pt; }
  </style></head><body>
  <div class="label">
    <div class="nome">${nomeProduto}</div>
    <div class="row"><span class="label-txt">PROD.</span><span class="val">${new Date(lote.dataProducao || Date.now()).toLocaleDateString('pt-PT')}</span></div>
    <div class="row"><span class="label-txt">VAL.</span><span class="val val-date">${lote.dataValidade ? new Date(lote.dataValidade).toLocaleDateString('pt-PT') : 'N/D'}</span></div>
    <div class="row"><span class="label-txt">Qtd.</span><span class="val">${Number(lote.quantidadeProduzida).toFixed(1)} ${lote.unidade}</span></div>
    <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&ecc=Q&data=${encodeURIComponent(url)}" width="80" height="80" /></div>
    <div class="metodo">${lote.metodoConservacao?.toUpperCase()}</div>
    ${lote.descongelado ? '<div class="warn">DESCONGELADO — NÃO RECONGELAR</div>' : ''}
    <div class="footer"><span>${lote.codigoLote}</span><span>${url.replace('https://', '')}</span></div>
  </div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}
