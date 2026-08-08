import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { CheckCircle, AlertTriangle, XCircle, RotateCcw, Package } from 'lucide-react';

// ── PIN Auth Screen ──────────────────────────────────────────────────────────
const PIN_TOKEN_KEY = 'kb_pin_token';
const PIN_USER_KEY = 'kb_pin_user';

function PinScreen({ onAuth, destino }: { onAuth: (token: string, nome: string) => void; destino: string }) {
  const [selectedUser, setSelectedUser] = useState<{ id: number; nome: string } | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { data: utilizadores } = trpc.qr.listarUtilizadoresPin.useQuery();
  const autenticar = trpc.qr.autenticarPin.useMutation();

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const novo = pin + d;
    setPin(novo);
    if (novo.length === 4 && selectedUser) {
      autenticar.mutate({ userId: selectedUser.id, pin: novo }, {
        onSuccess: (data) => {
          localStorage.setItem(PIN_TOKEN_KEY, data.token);
          localStorage.setItem(PIN_USER_KEY, selectedUser.nome);
          onAuth(data.token, selectedUser.nome);
        },
        onError: (err) => {
          setError(err.message);
          setPin('');
        },
      });
    }
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4" style={{ color: '#D4AF37' }}>
      <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'Cormorant Garamond, serif' }}>KB Kitchen</div>
      <div className="text-sm text-gray-400 mb-8">Identificação necessária</div>

      {!selectedUser ? (
        <div className="w-full max-w-xs space-y-3">
          <p className="text-center text-sm text-gray-300 mb-4">Selecciona o teu nome:</p>
          {(utilizadores ?? []).map(u => (
            <button key={u.id} onClick={() => setSelectedUser(u)}
              className="w-full py-4 rounded-xl text-lg font-medium border transition-colors"
              style={{ borderColor: '#D4AF37', color: '#D4AF37', background: 'rgba(212,175,55,0.08)' }}>
              {u.nome}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <p className="text-center text-base text-gray-300 mb-2">Olá, <strong style={{ color: '#D4AF37' }}>{selectedUser.nome}</strong></p>
          <p className="text-center text-sm text-gray-400 mb-6">Introduz o teu PIN (4 dígitos)</p>
          <div className="flex justify-center gap-3 mb-8">
            {[0,1,2,3].map(i => (
              <div key={i} className="w-4 h-4 rounded-full border-2 transition-all"
                style={{ borderColor: '#D4AF37', background: i < pin.length ? '#D4AF37' : 'transparent' }} />
            ))}
          </div>
          {error && <p className="text-red-400 text-center text-sm mb-4">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button key={i} onClick={() => d === '⌫' ? handleBackspace() : d ? handleDigit(d) : undefined}
                disabled={!d || autenticar.isPending}
                className="h-16 rounded-xl text-2xl font-bold transition-all active:scale-95"
                style={{ background: d ? 'rgba(212,175,55,0.12)' : 'transparent', color: '#D4AF37', border: d ? '1px solid rgba(212,175,55,0.3)' : 'none' }}>
                {d}
              </button>
            ))}
          </div>
          <button onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
            className="w-full mt-4 py-2 text-sm text-gray-500">← Mudar utilizador</button>
        </div>
      )}
    </div>
  );
}

// ── QR Exit Page ─────────────────────────────────────────────────────────────
export default function QrSaida() {
  const { codigo } = useParams<{ codigo: string }>();
  const [, navigate] = useLocation();
  const [pinToken, setPinToken] = useState<string | null>(() => localStorage.getItem(PIN_TOKEN_KEY));
  const [pinUser, setPinUser] = useState<string | null>(() => localStorage.getItem(PIN_USER_KEY));
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [estado, setEstado] = useState<'form' | 'sucesso' | 'erro'>('form');
  const [resultado, setResultado] = useState<{ movimentoId: number; stockApos: number; stockAnterior: number; abaixoMinimo: boolean } | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [tempoAnulacao, setTempoAnulacao] = useState(60);
  const anulacaoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: artigo, isLoading, error } = trpc.qr.obterPorCodigo.useQuery(
    { codigo: codigo ?? '' }, { enabled: !!codigo }
  );

  const sessaoQuery = trpc.qr.verificarSessaoPin.useQuery(
    { token: pinToken ?? '' }, { enabled: !!pinToken }
  );

  const registarSaida = trpc.qr.registarSaidaQr.useMutation();
  const anularMov = trpc.qr.anularMovimento.useMutation();

  // Offline queue
  const submitOffline = useCallback((payload: object) => {
    const queue = JSON.parse(localStorage.getItem('kb_offline_queue') ?? '[]');
    queue.push({ ...payload, ts: Date.now() });
    localStorage.setItem('kb_offline_queue', JSON.stringify(queue));
    toast.info('Sem rede — movimento guardado localmente. Será sincronizado automaticamente.');
  }, []);

  const handleConfirmar = () => {
    if (!artigo || !quantidade || Number(quantidade) <= 0) return;
    const idCliente = `qr_${codigo}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const payload = {
      codigoCurto: codigo!,
      quantidade: Number(quantidade),
      motivo: motivo || undefined,
      idCliente,
      pinToken: pinToken ?? undefined,
    };

    if (!navigator.onLine) {
      submitOffline(payload);
      setEstado('sucesso');
      setResultado({ movimentoId: -1, stockApos: (artigo.stockAtual ?? 0) - Number(quantidade), stockAnterior: artigo.stockAtual ?? 0, abaixoMinimo: false });
      return;
    }

    registarSaida.mutate(payload, {
      onSuccess: (data) => {
        setResultado({ movimentoId: data.movimentoId, stockApos: data.stockApos ?? 0, stockAnterior: data.stockAnterior ?? 0, abaixoMinimo: data.abaixoMinimo ?? false });
        setEstado('sucesso');
        // Start 60s countdown for cancellation
        setTempoAnulacao(60);
        anulacaoRef.current = setInterval(() => {
          setTempoAnulacao(t => {
            if (t <= 1) { clearInterval(anulacaoRef.current!); return 0; }
            return t - 1;
          });
        }, 1000);
      },
      onError: (err) => {
        toast.error(err.message);
        setEstado('erro');
      },
    });
  };

  const handleAnular = () => {
    if (!resultado || resultado.movimentoId < 0) return;
    setAnulando(true);
    anularMov.mutate({ movimentoId: resultado.movimentoId, pinToken: pinToken ?? undefined }, {
      onSuccess: () => {
        toast.success('Movimento anulado com sucesso');
        clearInterval(anulacaoRef.current!);
        setEstado('form');
        setQuantidade('');
        setResultado(null);
        setAnulando(false);
      },
      onError: (err) => { toast.error(err.message); setAnulando(false); },
    });
  };

  useEffect(() => () => { if (anulacaoRef.current) clearInterval(anulacaoRef.current); }, []);

  // Check PIN session validity
  const precisaPin = !pinToken || (sessaoQuery.data === null && !sessaoQuery.isLoading);

  if (precisaPin) {
    return <PinScreen destino={`/s/${codigo}`} onAuth={(token, nome) => { setPinToken(token); setPinUser(nome); }} />;
  }

  if (isLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error || !artigo) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <XCircle className="w-16 h-16 text-red-400 mb-4" />
      <h1 className="text-xl font-bold text-white mb-2">Etiqueta não reconhecida</h1>
      <p className="text-gray-400 mb-6">O código <strong>{codigo}</strong> não corresponde a nenhum ingrediente.</p>
      <button onClick={() => navigate('/ingredientes')}
        className="px-6 py-3 rounded-xl font-medium" style={{ background: '#D4AF37', color: '#000' }}>
        Pesquisar ingrediente
      </button>
    </div>
  );

  const unidade = artigo.unidadeBase;
  const stockAtual = artigo.stockAtual ?? 0;

  if (estado === 'sucesso' && resultado) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="w-16 h-16 mb-4" style={{ color: '#D4AF37' }} />
        <h1 className="text-2xl font-bold text-white mb-1">Registado!</h1>
        <p className="text-gray-400 mb-6">{artigo.nome}</p>
        <div className="w-full max-w-xs rounded-2xl p-5 mb-6" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <div className="flex justify-between mb-3">
            <span className="text-gray-400 text-sm">Antes</span>
            <span className="text-white font-bold">{resultado.stockAnterior.toFixed(1)} {unidade}</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className="text-gray-400 text-sm">Retirado</span>
            <span className="text-red-400 font-bold">−{quantidade} {unidade}</span>
          </div>
          <div className="flex justify-between pt-3 border-t" style={{ borderColor: 'rgba(212,175,55,0.2)' }}>
            <span className="text-gray-400 text-sm">Stock actual</span>
            <span className="font-bold text-lg" style={{ color: resultado.abaixoMinimo ? '#ef4444' : '#D4AF37' }}>
              {resultado.stockApos.toFixed(1)} {unidade}
            </span>
          </div>
        </div>
        {resultado.abaixoMinimo && (
          <div className="flex items-center gap-2 text-amber-400 text-sm mb-6">
            <AlertTriangle className="w-4 h-4" />
            Stock abaixo do mínimo
          </div>
        )}
        {resultado.movimentoId > 0 && tempoAnulacao > 0 && (
          <button onClick={handleAnular} disabled={anulando}
            className="w-full max-w-xs py-4 rounded-xl font-medium border text-sm transition-all"
            style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
            {anulando ? 'A anular...' : `Anular (${tempoAnulacao}s)`}
          </button>
        )}
        <button onClick={() => { setEstado('form'); setQuantidade(''); setResultado(null); }}
          className="mt-3 text-gray-500 text-sm">Nova saída</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col p-4 max-w-sm mx-auto" style={{ color: '#D4AF37' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
          <Package className="w-5 h-5" style={{ color: '#D4AF37' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{artigo.nome}</h1>
          <p className="text-xs text-gray-400">{artigo.categoria}</p>
        </div>
      </div>

      {/* Stock display */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Stock actual</p>
        <p className="text-3xl font-bold" style={{ color: stockAtual <= Number(artigo.stockMinimo ?? 0) ? '#ef4444' : '#D4AF37' }}>
          {stockAtual.toFixed(1)} <span className="text-lg">{unidade}</span>
        </p>
        {stockAtual <= Number(artigo.stockMinimo ?? 0) && (
          <p className="text-xs text-red-400 mt-1">⚠ Abaixo do mínimo</p>
        )}
      </div>

      {/* Shortcut buttons */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 5, 10].map(v => (
          <button key={v} onClick={() => setQuantidade(String(v))}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: quantidade === String(v) ? '#D4AF37' : 'rgba(212,175,55,0.12)', color: quantidade === String(v) ? '#000' : '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
            {v} {unidade}
          </button>
        ))}
      </div>

      {/* Numeric keypad */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-center text-4xl font-bold mb-4 min-h-[3rem]" style={{ color: quantidade ? '#D4AF37' : '#555' }}>
          {quantidade || '0'} <span className="text-xl">{unidade}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((d, i) => (
            <button key={i} onClick={() => {
              if (d === '⌫') { setQuantidade(q => q.slice(0, -1)); return; }
              if (d === '.' && quantidade.includes('.')) return;
              setQuantidade(q => q + d);
            }}
              className="h-14 rounded-xl text-xl font-bold transition-all active:scale-95"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Motivo */}
      <input value={motivo} onChange={e => setMotivo(e.target.value)}
        placeholder="Motivo (opcional)"
        className="w-full rounded-xl px-4 py-3 text-sm mb-4"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.2)', color: '#fff', outline: 'none' }} />

      {/* Confirm button */}
      <button onClick={handleConfirmar}
        disabled={!quantidade || Number(quantidade) <= 0 || registarSaida.isPending}
        className="w-full py-5 rounded-2xl text-lg font-bold transition-all active:scale-98 disabled:opacity-40"
        style={{ background: '#D4AF37', color: '#000' }}>
        {registarSaida.isPending ? 'A registar...' : `Confirmar saída de ${quantidade || '0'} ${unidade}`}
      </button>

      {/* User info */}
      <p className="text-center text-xs text-gray-600 mt-4">
        {pinUser ?? 'Anónimo'} · <button onClick={() => { localStorage.removeItem(PIN_TOKEN_KEY); localStorage.removeItem(PIN_USER_KEY); setPinToken(null); setPinUser(null); }} className="underline">Sair</button>
      </p>
    </div>
  );
}
