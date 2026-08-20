import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq, and, desc, avg, min, max } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { testesRendimento, artigos } from "../../drizzle/schema";
import { registarMovimento } from "../engine/stock";
import { calcularCustoRendimento, criarChavesIdempotenciaRendimento } from "../engine/rendimento";

export const rendimentoRouter = router({
  listar: protectedProcedure
    .input(z.object({ artigoId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = db.select({
        teste: testesRendimento,
        artigoNome: artigos.nome,
      }).from(testesRendimento)
        .leftJoin(artigos, eq(testesRendimento.artigoId, artigos.id))
        .orderBy(desc(testesRendimento.createdAt));
      if (input?.artigoId) {
        return (await q.where(eq(testesRendimento.artigoId, input.artigoId))).map(r => ({ ...r.teste, artigoNome: r.artigoNome }));
      }
      return (await q).map(r => ({ ...r.teste, artigoNome: r.artigoNome }));
    }),

  estatisticas: protectedProcedure
    .input(z.object({ artigoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [stats] = await db.select({
        mediaAproveitamento: avg(testesRendimento.aproveitamentoPct),
        melhorAproveitamento: max(testesRendimento.aproveitamentoPct),
        piorAproveitamento: min(testesRendimento.aproveitamentoPct),
        mediaCustoReal: avg(testesRendimento.custoRealPorKg),
        total: db.$count(testesRendimento, eq(testesRendimento.artigoId, input.artigoId)),
      }).from(testesRendimento).where(eq(testesRendimento.artigoId, input.artigoId));
      return stats;
    }),

  registar: protectedProcedure
    .input(z.object({
      artigoId: z.number(),
      artigoLimpoId: z.number().optional(),
      pesoBruto: z.number().positive(),
      pesoLimpo: z.number().positive(),
      pesoAparas: z.number().min(0).default(0),
      valorAparas: z.number().min(0).default(0),
      pesoDesperdicio: z.number().min(0).default(0),
      precoKgBruto: z.number().positive(),
      criarMovimentos: z.boolean().default(true),
      idCliente: z.string().min(8).max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const idCliente = input.idCliente ?? randomUUID();
      const chavesIdempotencia = criarChavesIdempotenciaRendimento(idCliente);
      const [existente] = await db.select().from(testesRendimento)
        .where(eq(testesRendimento.idCliente, chavesIdempotencia.teste)).limit(1);
      if (existente) {
        return {
          id: existente.id,
          aproveitamentoPct: parseFloat(existente.aproveitamentoPct ?? "0"),
          perdaPct: parseFloat(existente.perdaPct ?? "0"),
          custoRealPorKg: parseFloat(existente.custoRealPorKg ?? "0"),
          custoPorGrama: parseFloat(existente.custoRealPorKg ?? "0") / 1000,
          sobrecusto: parseFloat(existente.sobrecusto ?? "0"),
          idempotente: true,
        };
      }
      const calculo = calcularCustoRendimento({
        pesoBrutoGramas: input.pesoBruto,
        pesoLimpoGramas: input.pesoLimpo,
        precoKgBruto: input.precoKgBruto,
        valorAparas: input.valorAparas,
      });
      const documentoId = input.criarMovimentos ? `rendimento_${randomUUID()}` : undefined;

      return db.transaction(async (tx) => {
        const [artigoBruto] = await tx.select({
          id: artigos.id,
          requerLimpeza: artigos.requerLimpeza,
          ativo: artigos.ativo,
        }).from(artigos).where(eq(artigos.id, input.artigoId)).limit(1);
        if (!artigoBruto?.ativo || !artigoBruto.requerLimpeza) {
          throw new Error("Selecciona uma proteína marcada para rendimento.");
        }

        if (input.criarMovimentos) {
          if (!input.artigoLimpoId) {
            throw new Error("Selecciona o artigo limpo de destino antes de registar o rendimento.");
          }
          const [artigoLimpo] = await tx.select({ id: artigos.id }).from(artigos).where(and(
            eq(artigos.id, input.artigoLimpoId),
            eq(artigos.tipo, "proteina_limpa"),
            eq(artigos.artigoBrutoId, input.artigoId),
            eq(artigos.ativo, true),
          )).limit(1);
          if (!artigoLimpo) {
            throw new Error("O artigo limpo selecionado não está associado à proteína bruta.");
          }
        }

        let movimentoSaidaId: number | undefined;
        let movimentoEntradaId: number | undefined;
        if (input.criarMovimentos && input.artigoLimpoId) {
          const saida = await registarMovimento({
            artigoId: input.artigoId,
            tipo: "transformacao_saida",
            quantidade: -input.pesoBruto,
            custoUnitario: input.precoKgBruto / 1000,
            documentoId,
            documentoTipo: "rendimento",
            origem: "sistema",
            idCliente: chavesIdempotencia.saida,
            utilizadorId: ctx.user?.id,
          }, tx as any);
          movimentoSaidaId = saida.movimentoId;

          const entrada = await registarMovimento({
            artigoId: input.artigoLimpoId,
            tipo: "transformacao_entrada",
            quantidade: input.pesoLimpo,
            custoUnitario: calculo.custoPorGrama,
            documentoId,
            documentoTipo: "rendimento",
            origem: "sistema",
            idCliente: chavesIdempotencia.entrada,
            utilizadorId: ctx.user?.id,
          }, tx as any);
          movimentoEntradaId = entrada.movimentoId;
        }

        const [r] = await tx.insert(testesRendimento).values({
          artigoId: input.artigoId,
          artigoLimpoId: input.artigoLimpoId,
          pesoBruto: input.pesoBruto.toFixed(3),
          pesoLimpo: input.pesoLimpo.toFixed(3),
          pesoAparas: input.pesoAparas.toFixed(3),
          valorAparas: input.valorAparas.toFixed(4),
          pesoDesperdicio: input.pesoDesperdicio.toFixed(3),
          precoKgBruto: input.precoKgBruto.toFixed(4),
          aproveitamentoPct: calculo.aproveitamentoPct.toFixed(3),
          perdaPct: calculo.perdaPct.toFixed(3),
          custoRealPorKg: calculo.custoRealPorKg.toFixed(4),
          sobrecusto: calculo.sobrecusto.toFixed(4),
          movimentoSaidaId,
          movimentoEntradaId,
          idCliente: chavesIdempotencia.teste,
          utilizadorId: ctx.user?.id,
        } as any);

        return {
          id: (r as any).insertId,
          documentoId,
          aproveitamentoPct: calculo.aproveitamentoPct,
          perdaPct: calculo.perdaPct,
          custoRealPorKg: calculo.custoRealPorKg,
          custoPorGrama: calculo.custoPorGrama,
          sobrecusto: calculo.sobrecusto,
          idempotente: false,
        };
      });
    }),
});
