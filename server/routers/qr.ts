import { z } from 'zod';
import { eq, and, isNull, sql, lte, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router, roleProcedure } from '../_core/trpc';
import { getDb } from '../db';
import {
  artigos, movimentos, lotes, regrasValidade, sessoesPinQr, users, credenciaisLocais,
} from '../../drizzle/schema';
import { gerarCodigoCurtoSync, gerarCodigoLoteSync } from '../utils/codigoCurto';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { registarMovimento, calcularStock } from '../engine/stock';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function calcularValidadeData(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  artigoId: number | null,
  fichaId: number | null,
  metodo: string,
  dataBase: Date = new Date()
): Promise<Date | null> {
  const conds = [eq(regrasValidade.metodoConservacao, metodo as any)];
  if (artigoId) conds.push(eq(regrasValidade.artigoId, artigoId));
  else if (fichaId) conds.push(eq(regrasValidade.fichaId, fichaId));
  else return null;

  const [regra] = await db.select().from(regrasValidade).where(and(...conds)).limit(1);
  if (!regra) return null;
  const d = new Date(dataBase);
  d.setDate(d.getDate() + regra.diasValidade);
  return d;
}

export const qrRouter = router({

  // ── Get ingredient by short code ──────────────────────────────────────────
  obterPorCodigo: publicProcedure
    .input(z.object({ codigo: z.string().min(1).max(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Base de dados indisponível' });
      const [artigo] = await db.select().from(artigos)
        .where(and(eq(artigos.codigoCurto, input.codigo.toUpperCase()), eq(artigos.ativo, true)))
        .limit(1);
      if (!artigo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Etiqueta não reconhecida' });
      const stockAtual = await calcularStock(artigo.id);
      return { ...artigo, stockAtual };
    }),

  // ── Register stock exit via QR (idempotent) ───────────────────────────────
  registarSaidaQr: publicProcedure
    .input(z.object({
      codigoCurto: z.string().min(1).max(10),
      quantidade: z.number().positive(),
      motivo: z.string().optional(),
      idCliente: z.string().min(1).max(64),
      pinToken: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Idempotency check
      const [existing] = await db.select({ id: movimentos.id, stockApos: movimentos.stockApos })
        .from(movimentos).where(eq(movimentos.idCliente, input.idCliente)).limit(1);
      if (existing) return {
        success: true, movimentoId: existing.id,
        stockApos: Number(existing.stockApos), duplicado: true,
      };

      const [artigo] = await db.select().from(artigos)
        .where(and(eq(artigos.codigoCurto, input.codigoCurto.toUpperCase()), eq(artigos.ativo, true)))
        .limit(1);
      if (!artigo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Artigo não encontrado' });

      // Resolve user from PIN token
      let utilizadorId: number | null = null;
      if (input.pinToken) {
        const tokenHash = hashToken(input.pinToken);
        const [sessao] = await db.select().from(sessoesPinQr)
          .where(and(eq(sessoesPinQr.tokenHash, tokenHash), isNull(sessoesPinQr.revogadaEm)))
          .limit(1);
        if (sessao && sessao.expiresAt > new Date()) utilizadorId = sessao.userId;
      }

      const stockAtual = await calcularStock(artigo.id);
      const custoUnitario = Number(artigo.custoMedioPonderado ?? 0);
      const qtdNegativa = -Math.abs(input.quantidade);
      const stockApos = stockAtual + qtdNegativa;

      const [result] = await db.insert(movimentos).values({
        artigoId: artigo.id,
        tipo: 'quebra',
        quantidade: qtdNegativa.toFixed(3),
        custoUnitario: custoUnitario.toFixed(6),
        stockApos: stockApos.toFixed(3),
        motivo: input.motivo ?? 'Saída por QR Code',
        utilizadorId: utilizadorId ?? undefined,
        idCliente: input.idCliente,
        origem: 'qr',
        dataMovimento: new Date(),
      } as any);

      return {
        success: true,
        movimentoId: (result as any).insertId,
        stockApos,
        stockAnterior: stockAtual,
        abaixoMinimo: stockApos < Number(artigo.stockMinimo ?? 0),
        duplicado: false,
      };
    }),

  // ── Anular movimento (60s window) ─────────────────────────────────────────
  anularMovimento: publicProcedure
    .input(z.object({ movimentoId: z.number().int().positive(), pinToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const [mov] = await db.select().from(movimentos).where(eq(movimentos.id, input.movimentoId)).limit(1);
      if (!mov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Movimento não encontrado' });
      if (mov.anuladoEm) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Movimento já anulado' });

      const age = Date.now() - new Date(mov.createdAt).getTime();
      if (age > 70_000) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Prazo de anulação expirado (60 segundos)' });

      await db.update(movimentos).set({ anuladoEm: new Date() } as any).where(eq(movimentos.id, mov.id));

      const qtdInversa = -Number(mov.quantidade);
      const stockAtual = await calcularStock(mov.artigoId);
      const stockApos = stockAtual + qtdInversa;

      const [result] = await db.insert(movimentos).values({
        artigoId: mov.artigoId,
        tipo: mov.tipo,
        quantidade: qtdInversa.toFixed(3),
        custoUnitario: mov.custoUnitario,
        stockApos: stockApos.toFixed(3),
        motivo: 'Anulação de movimento QR',
        utilizadorId: mov.utilizadorId ?? undefined,
        origem: 'qr',
        dataMovimento: new Date(),
      } as any);

      const invId = (result as any).insertId;
      await db.update(movimentos).set({ anuladoPorMovimentoId: invId } as any).where(eq(movimentos.id, mov.id));

      return { success: true, movimentoAnulacaoId: invId };
    }),

  // ── PIN Authentication ────────────────────────────────────────────────────
  listarUtilizadoresPin: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({ id: users.id, nome: users.name, role: users.role })
      .from(users).where(eq(users.ativo, true));
    return rows.map(r => ({ id: r.id, nome: r.nome ?? 'Utilizador', role: r.role }));
  }),

  autenticarPin: publicProcedure
    .input(z.object({ userId: z.number().int().positive(), pin: z.string().min(4).max(6) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const [cred] = await db.select().from(credenciaisLocais)
        .where(and(eq(credenciaisLocais.userId, input.userId), eq(credenciaisLocais.ativo, true)))
        .limit(1);
      if (!cred) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Utilizador sem PIN configurado' });

      const ok = await bcrypt.compare(input.pin, cred.passwordHash);
      if (!ok) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'PIN incorreto' });

      const token = randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(sessoesPinQr).values({ userId: input.userId, tokenHash, expiresAt });
      return { token, expiresAt };
    }),

  verificarSessaoPin: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const tokenHash = hashToken(input.token);
      const [sessao] = await db.select({ id: sessoesPinQr.id, userId: sessoesPinQr.userId, expiresAt: sessoesPinQr.expiresAt })
        .from(sessoesPinQr)
        .where(and(eq(sessoesPinQr.tokenHash, tokenHash), isNull(sessoesPinQr.revogadaEm)))
        .limit(1);
      if (!sessao || sessao.expiresAt < new Date()) return null;
      const [user] = await db.select({ id: users.id, nome: users.name, role: users.role })
        .from(users).where(eq(users.id, sessao.userId)).limit(1);
      return user ? { userId: user.id, nome: user.nome, role: user.role } : null;
    }),

  revogarSessaoPin: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.update(sessoesPinQr)
        .set({ revogadaEm: new Date() } as any)
        .where(and(eq(sessoesPinQr.userId, input.userId), isNull(sessoesPinQr.revogadaEm)));
      return { success: true };
    }),

  // ── Lotes ─────────────────────────────────────────────────────────────────
  criarLote: protectedProcedure
    .input(z.object({
      artigoId: z.number().int().optional(),
      fichaId: z.number().int().optional(),
      quantidadeProduzida: z.number().positive(),
      unidade: z.string(),
      metodoConservacao: z.enum(['vacuo', 'refrigerado', 'congelado', 'ambiente']),
      dataValidade: z.string().optional(),
      descongelado: z.boolean().default(false),
      notas: z.string().optional(),
      producaoId: z.number().int().optional(),
      ingredientesUsados: z.array(z.object({ artigoId: z.number(), quantidade: z.number() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      let dataValidade: Date | null = null;
      if (input.dataValidade) {
        dataValidade = new Date(input.dataValidade);
      } else {
        dataValidade = await calcularValidadeData(db, input.artigoId ?? null, input.fichaId ?? null, input.metodoConservacao);
      }

      let codigoLote = gerarCodigoLoteSync(8);
      for (let i = 0; i < 10; i++) {
        const [ex] = await db.select({ id: lotes.id }).from(lotes).where(eq(lotes.codigoLote, codigoLote)).limit(1);
        if (!ex) break;
        codigoLote = gerarCodigoLoteSync(8);
      }

      const [result] = await db.insert(lotes).values({
        codigoLote,
        artigoId: input.artigoId,
        fichaId: input.fichaId,
        quantidadeProduzida: input.quantidadeProduzida.toFixed(3),
        quantidadeRestante: input.quantidadeProduzida.toFixed(3),
        unidade: input.unidade,
        metodoConservacao: input.metodoConservacao,
        dataValidade: dataValidade ? dataValidade.toISOString().split('T')[0] : null,
        descongelado: input.descongelado,
        notas: input.notas,
        producaoId: input.producaoId,
        utilizadorId: ctx.user.id,
        ingredientesUsados: input.ingredientesUsados ? JSON.stringify(input.ingredientesUsados) : null,
      } as any);

      const [lote] = await db.select().from(lotes).where(eq(lotes.id, (result as any).insertId)).limit(1);
      return lote;
    }),

  obterLotePorCodigo: publicProcedure
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [lote] = await db.select().from(lotes)
        .where(eq(lotes.codigoLote, input.codigo.toUpperCase()))
        .limit(1);
      if (!lote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lote não encontrado' });

      let nomeProduto = 'Produto desconhecido';
      if (lote.artigoId) {
        const [a] = await db.select({ nome: artigos.nome }).from(artigos).where(eq(artigos.id, lote.artigoId)).limit(1);
        if (a) nomeProduto = a.nome;
      }

      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const validade = lote.dataValidade ? new Date(lote.dataValidade) : null;
      const diasRestantes = validade ? Math.floor((validade.getTime() - hoje.getTime()) / 86400000) : null;

      const historico = await db.select({
        id: movimentos.id,
        tipo: movimentos.tipo,
        quantidade: movimentos.quantidade,
        motivo: movimentos.motivo,
        dataMovimento: movimentos.dataMovimento,
      }).from(movimentos).where(eq(movimentos.loteId, lote.id)).orderBy(desc(movimentos.dataMovimento)).limit(12);
      return { ...lote, nomeProduto, diasRestantes, movimentos: historico };
    }),

  consumirLote: publicProcedure
    .input(z.object({
      codigoLote: z.string(),
      quantidade: z.number().positive(),
      pinToken: z.string().optional(),
      idCliente: z.string().min(8).max(64).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return db.transaction(async (tx) => {
        const [lote] = await tx.select().from(lotes).where(eq(lotes.codigoLote, input.codigoLote.toUpperCase())).limit(1);
        if (!lote) throw new TRPCError({ code: 'NOT_FOUND' });
        if (!lote.artigoId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este lote não está associado a um artigo de stock.' });
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const validade = lote.dataValidade ? new Date(lote.dataValidade) : null;
        if (validade && validade < hoje && lote.estado !== 'descartado') throw new TRPCError({ code: 'FORBIDDEN', message: 'Lote expirado. Requer autorização de gestor para descarte.' });
        if (input.quantidade > Number(lote.quantidadeRestante)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quantidade superior ao saldo disponível do lote.' });
        const [artigo] = await tx.select().from(artigos).where(eq(artigos.id, lote.artigoId)).limit(1);
        if (!artigo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Artigo do lote não encontrado.' });
        const restante = Number(lote.quantidadeRestante) - input.quantidade;
        const novoEstado = restante <= 0 ? 'esgotado' : lote.estado;
        const chave = input.idCliente ?? `lote-${lote.id}-${Date.now()}`;
        const { movimentoId } = await registarMovimento({ artigoId: lote.artigoId, loteId: lote.id, tipo: 'producao_consumo', quantidade: -input.quantidade, custoUnitario: Number(artigo.custoMedioPonderado ?? 0), documentoId: `lote_${lote.codigoLote}`, documentoTipo: 'lote', motivo: `Consumo do lote ${lote.codigoLote}`, origem: 'qr', idCliente: chave }, tx as any);
        await tx.update(lotes).set({ quantidadeRestante: Math.max(0, restante).toFixed(3), estado: novoEstado } as any).where(eq(lotes.id, lote.id));
        return { success: true, movimentoId, quantidadeRestante: Math.max(0, restante), estado: novoEstado };
      });
    }),

  descartarLote: roleProcedure(['head_chef'])
    .input(z.object({ codigoLote: z.string(), motivo: z.string().trim().min(3).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return db.transaction(async (tx) => {
        const [lote] = await tx.select().from(lotes).where(eq(lotes.codigoLote, input.codigoLote.toUpperCase())).limit(1);
        if (!lote) throw new TRPCError({ code: 'NOT_FOUND' });
        if (lote.estado === 'descartado') return { success: true, duplicado: true };
        let movimentoId: number | null = null;
        const restante = Number(lote.quantidadeRestante);
        if (lote.artigoId && restante > 0) {
          const [artigo] = await tx.select().from(artigos).where(eq(artigos.id, lote.artigoId)).limit(1);
          if (!artigo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Artigo do lote não encontrado.' });
          const movimento = await registarMovimento({ artigoId: lote.artigoId, loteId: lote.id, tipo: 'quebra', quantidade: -restante, custoUnitario: Number(artigo.custoMedioPonderado ?? 0), documentoId: `lote_${lote.codigoLote}`, documentoTipo: 'lote', motivo: `Descarte do lote ${lote.codigoLote}: ${input.motivo}`, origem: 'sistema', idCliente: `lote-descartar-${lote.id}`, utilizadorId: ctx.user?.id }, tx as any);
          movimentoId = movimento.movimentoId;
        }
        await tx.update(lotes).set({ estado: 'descartado', quantidadeRestante: '0.000', notas: (lote.notas ?? '') + ` | Descartado: ${input.motivo}` } as any).where(eq(lotes.id, lote.id));
        return { success: true, duplicado: false, movimentoId };
      });
    }),

  listarLotes: protectedProcedure
    .input(z.object({
      estado: z.enum(['ativo', 'esgotado', 'expirado', 'descartado', 'todos']).default('ativo'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = input.estado !== 'todos' ? [eq(lotes.estado, input.estado as any)] : [];
      const rows = await db.select({
        id: lotes.id, codigoLote: lotes.codigoLote, artigoId: lotes.artigoId,
        quantidadeProduzida: lotes.quantidadeProduzida, quantidadeRestante: lotes.quantidadeRestante,
        unidade: lotes.unidade, dataProducao: lotes.dataProducao, dataValidade: lotes.dataValidade,
        metodoConservacao: lotes.metodoConservacao, estado: lotes.estado, descongelado: lotes.descongelado,
        nomeProduto: artigos.nome,
      }).from(lotes)
        .leftJoin(artigos, eq(lotes.artigoId, artigos.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(lotes.dataValidade)
        .limit(200);
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      return rows.map(r => ({
        ...r,
        diasRestantes: r.dataValidade ? Math.floor((new Date(r.dataValidade).getTime() - hoje.getTime()) / 86400000) : null,
      }));
    }),

  // ── Regras de Validade ────────────────────────────────────────────────────
  listarRegrasValidade: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      id: regrasValidade.id, artigoId: regrasValidade.artigoId, fichaId: regrasValidade.fichaId,
      metodoConservacao: regrasValidade.metodoConservacao, diasValidade: regrasValidade.diasValidade,
      nomeArtigo: artigos.nome,
    }).from(regrasValidade)
      .leftJoin(artigos, eq(regrasValidade.artigoId, artigos.id))
      .orderBy(artigos.nome);
    return rows;
  }),

  criarRegraValidade: roleProcedure(['admin', 'head_chef'])
    .input(z.object({
      artigoId: z.number().int().optional(),
      fichaId: z.number().int().optional(),
      metodoConservacao: z.enum(['vacuo', 'refrigerado', 'congelado', 'ambiente']),
      diasValidade: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.insert(regrasValidade).values({ ...input, criadoPor: ctx.user.id } as any);
      return { success: true };
    }),

  eliminarRegraValidade: roleProcedure(['admin', 'head_chef'])
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.delete(regrasValidade).where(eq(regrasValidade.id, input.id));
      return { success: true };
    }),

  // ── Generate short code for artigo ───────────────────────────────────────
  gerarCodigoCurto: roleProcedure(['admin', 'head_chef'])
    .input(z.object({ artigoId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [artigo] = await db.select({ id: artigos.id, codigoCurto: artigos.codigoCurto })
        .from(artigos).where(eq(artigos.id, input.artigoId)).limit(1);
      if (!artigo) throw new TRPCError({ code: 'NOT_FOUND' });
      if (artigo.codigoCurto) return { codigoCurto: artigo.codigoCurto };

      let codigo = gerarCodigoCurtoSync(6);
      for (let i = 0; i < 20; i++) {
        const [ex] = await db.select({ id: artigos.id }).from(artigos).where(eq(artigos.codigoCurto, codigo)).limit(1);
        if (!ex) break;
        codigo = gerarCodigoCurtoSync(6);
      }
      await db.update(artigos).set({ codigoCurto: codigo } as any).where(eq(artigos.id, input.artigoId));
      return { codigoCurto: codigo };
    }),

  // ── Expiry alerts ─────────────────────────────────────────────────────────
  alertasValidade: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { expirados: [], aExpirar48h: [] };

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em48h = new Date(hoje.getTime() + 48 * 60 * 60 * 1000);

    const expirados = await db.select({
      id: lotes.id, codigoLote: lotes.codigoLote, dataValidade: lotes.dataValidade,
      metodoConservacao: lotes.metodoConservacao, quantidadeRestante: lotes.quantidadeRestante,
      unidade: lotes.unidade, nomeProduto: artigos.nome,
    }).from(lotes)
      .leftJoin(artigos, eq(lotes.artigoId, artigos.id))
      .where(and(eq(lotes.estado, 'ativo'), sql`${lotes.dataValidade} < ${hoje.toISOString().split('T')[0]}`))
      .orderBy(lotes.dataValidade)
      .limit(50);

    const aExpirar = await db.select({
      id: lotes.id, codigoLote: lotes.codigoLote, dataValidade: lotes.dataValidade,
      metodoConservacao: lotes.metodoConservacao, quantidadeRestante: lotes.quantidadeRestante,
      unidade: lotes.unidade, nomeProduto: artigos.nome,
    }).from(lotes)
      .leftJoin(artigos, eq(lotes.artigoId, artigos.id))
      .where(and(
        eq(lotes.estado, 'ativo'),
        sql`${lotes.dataValidade} >= ${hoje.toISOString().split('T')[0]}`,
        sql`${lotes.dataValidade} <= ${em48h.toISOString().split('T')[0]}`,
      ))
      .orderBy(lotes.dataValidade)
      .limit(50);

    const todayStr = hoje.toISOString().split('T')[0];
    return {
      expirados: expirados.map(r => ({ ...r, diasRestantes: r.dataValidade ? Math.floor((new Date(r.dataValidade).getTime() - hoje.getTime()) / 86400000) : null })),
      aExpirar48h: aExpirar.map(r => ({ ...r, diasRestantes: r.dataValidade ? Math.floor((new Date(r.dataValidade).getTime() - hoje.getTime()) / 86400000) : null })),
    };
  }),
});
