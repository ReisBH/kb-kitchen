import { z } from "zod";
import { eq, and, desc, avg, min, max } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { testesRendimento, artigos } from "../../drizzle/schema";
import { registarMovimento } from "../engine/stock";

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
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      const [artigoBruto] = await db.select({
        id: artigos.id,
        nome: artigos.nome,
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
        const [artigoLimpo] = await db.select({ id: artigos.id }).from(artigos).where(and(
          eq(artigos.id, input.artigoLimpoId),
          eq(artigos.tipo, "proteina_limpa"),
          eq(artigos.artigoBrutoId, input.artigoId),
          eq(artigos.ativo, true),
        )).limit(1);
        if (!artigoLimpo) {
          throw new Error("O artigo limpo selecionado não está associado à proteína bruta.");
        }
      }

      // Cálculos de rendimento
      const aproveitamentoPct = (input.pesoLimpo / input.pesoBruto) * 100;
      const perdaPct = 100 - aproveitamentoPct;
      const custoTotal = (input.pesoBruto / 1000) * input.precoKgBruto;
      const custoLiquido = custoTotal - input.valorAparas;
      const custoRealPorKg = custoLiquido / input.pesoLimpo;
      const sobrecusto = custoRealPorKg - input.precoKgBruto;

      let movimentoSaidaId: number | undefined;
      let movimentoEntradaId: number | undefined;

      if (input.criarMovimentos) {
        // Saída do artigo bruto
        const saida = await registarMovimento({
          artigoId: input.artigoId,
          tipo: "transformacao_saida",
          quantidade: -input.pesoBruto,
          custoUnitario: input.precoKgBruto / 1000, // preço por g
          documentoTipo: "rendimento",
          utilizadorId: ctx.user?.id,
        });
        movimentoSaidaId = saida.movimentoId;

        // Entrada do artigo limpo (se existir)
        if (input.artigoLimpoId) {
          const entrada = await registarMovimento({
            artigoId: input.artigoLimpoId,
            tipo: "transformacao_entrada",
            quantidade: input.pesoLimpo,
            custoUnitario: custoRealPorKg / 1000, // custo real por g
            documentoTipo: "rendimento",
            utilizadorId: ctx.user?.id,
          });
          movimentoEntradaId = entrada.movimentoId;
        }
      }

      const [r] = await db.insert(testesRendimento).values({
        artigoId: input.artigoId,
        artigoLimpoId: input.artigoLimpoId,
        pesoBruto: input.pesoBruto.toFixed(3),
        pesoLimpo: input.pesoLimpo.toFixed(3),
        pesoAparas: input.pesoAparas.toFixed(3),
        valorAparas: input.valorAparas.toFixed(4),
        pesoDesperdicio: input.pesoDesperdicio.toFixed(3),
        precoKgBruto: input.precoKgBruto.toFixed(4),
        aproveitamentoPct: aproveitamentoPct.toFixed(3),
        perdaPct: perdaPct.toFixed(3),
        custoRealPorKg: custoRealPorKg.toFixed(4),
        sobrecusto: sobrecusto.toFixed(4),
        movimentoSaidaId,
        movimentoEntradaId,
        utilizadorId: ctx.user?.id,
      } as any);

      return {
        id: (r as any).insertId,
        aproveitamentoPct,
        perdaPct,
        custoRealPorKg,
        sobrecusto,
      };
    }),
});
