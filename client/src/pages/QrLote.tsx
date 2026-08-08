import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, XCircle, Trash2, Package } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';

function diasCor(dias: number | null) {
  if (dias === null) return '#9ca3af';
  if (dias < 0) return '#ef4444';
  if (dias <= 1) return '#f59e0b';
  return '#22c55e';
}

export default function QrLote() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user } = useAuth();
  const [consumindo, setConsumindo] = useState(false);
  const [qtdConsumo, setQtdConsumo] = useState('');
  const { data: lote, isLoading, error, refetch } = trpc.qr.obterLotePorCodigo.useQuery({ codigo: codigo ?? '' }, { enabled: !!codigo });
  const consumir = trpc.qr.consumirLote.useMutation();
  const descartar = trpc.qr.descartarLote.useMutation();

  if (isLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error || !lote) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <XCircle className="w-16 h-16 text-red-400 mb-4" />
      <h1 className="text-xl font-bold text-white mb-2">Lote não encontrado</h1>
      <p className="text-gray-400">O código <strong>{codigo}</strong> não corresponde a nenhum lote.</p>
    </div>
  );

  const expirado = lote.diasRestantes !== null && lote.diasRestantes < 0;
  const cor = diasCor(lote.diasRestantes);

  const handleConsumir = () => {
    if (!qtdConsumo || Number(qtdConsumo) <= 0) return;
    consumir.mutate({ codigoLote: codigo!, quantidade: Number(qtdConsumo) }, {
      onSuccess: () => { toast.success('Consumo registado'); setConsumindo(false); setQtdConsumo(''); refetch(); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDescartar = () => {
    if (!confirm('Confirmar descarte deste lote?')) return;
    descartar.mutate({ codigoLote: codigo!, motivo: 'Descarte manual' }, {
      onSuccess: () => { toast.success('Lote descartado'); refetch(); },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="min-h-screen bg-black p-4 max-w-sm mx-auto" style={{ color: '#D4AF37' }}>
      {expirado && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="font-bold text-red-400 text-lg">LOTE EXPIRADO</p>
          <p className="text-red-300 text-sm">Consumo bloqueado. Requer autorização de gestor.</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
          <Package className="w-6 h-6" style={{ color: '#D4AF37' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{lote.nomeProduto}</h1>
          <p className="text-xs text-gray-400">Lote: {lote.codigoLote}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <p className="text-xs text-gray-400 mb-1">PROD.</p>
          <p className="font-bold text-white text-sm">{new Date(lote.dataProducao).toLocaleDateString('pt-PT')}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: expirado ? 'rgba(239,68,68,0.15)' : 'rgba(212,175,55,0.08)', border: `1px solid ${expirado ? '#ef4444' : 'rgba(212,175,55,0.2)'}` }}>
          <p className="text-xs text-gray-400 mb-1">VAL.</p>
          <p className="font-bold text-sm" style={{ color: cor }}>
            {lote.dataValidade ? new Date(lote.dataValidade).toLocaleDateString('pt-PT') : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm">Dias restantes</span>
          <span className="font-bold text-lg" style={{ color: cor }}>
            {lote.diasRestantes === null ? '—' : lote.diasRestantes < 0 ? `${Math.abs(lote.diasRestantes)}d expirado` : `${lote.diasRestantes}d`}
          </span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm">Quantidade restante</span>
          <span className="font-bold text-white">{Number(lote.quantidadeRestante).toFixed(1)} {lote.unidade}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Método</span>
          <span className="text-white text-sm capitalize">{lote.metodoConservacao}</span>
        </div>
        {lote.descongelado && (
          <div className="mt-2 text-amber-400 text-xs font-bold">⚠ DESCONGELADO — NÃO RECONGELAR</div>
        )}
      </div>

      {!expirado && lote.estado === 'ativo' && (
        consumindo ? (
          <div className="space-y-3">
            <input value={qtdConsumo} onChange={e => setQtdConsumo(e.target.value)} type="number" min="0.1" step="0.1"
              placeholder={`Quantidade (${lote.unidade})`}
              className="w-full rounded-xl px-4 py-3 text-center text-xl font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', outline: 'none' }} />
            <button onClick={handleConsumir} disabled={consumir.isPending}
              className="w-full py-4 rounded-xl font-bold text-lg" style={{ background: '#D4AF37', color: '#000' }}>
              {consumir.isPending ? 'A registar...' : 'Confirmar consumo'}
            </button>
            <button onClick={() => setConsumindo(false)} className="w-full py-3 text-gray-500 text-sm">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConsumindo(true)}
            className="w-full py-5 rounded-2xl font-bold text-lg mb-3" style={{ background: '#D4AF37', color: '#000' }}>
            Registar consumo
          </button>
        )
      )}

      {(user?.role === 'admin' || user?.role === 'head_chef') && lote.estado === 'ativo' && (
        <button onClick={handleDescartar} disabled={descartar.isPending}
          className="w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
          style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
          <Trash2 className="w-4 h-4" /> Descartar lote
        </button>
      )}

      {lote.estado !== 'ativo' && (
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-gray-400 text-sm capitalize">Estado: {lote.estado}</p>
        </div>
      )}
    </div>
  );
}
