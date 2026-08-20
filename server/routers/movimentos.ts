import { z } from "zod";
import { eq, and, desc, gte, lte, isNull, sql } from "drizzle-orm";
import { protectedProcedure, roleProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { movimentos, artigos, lotes } from "../../drizzle/schema";
import { criarDadosEstorno, registarMovimento } from "../engine/stock";

export const movimentosRouter = router({
  listar: protectedProcedure
    .input(z.object({
      artigoId: z.number().optional(),
      tipo: z.string().optional(),
      de: z.date().optional(),
      ate: z.date().optional(),
      limite: z.number().default(100),
      pagina: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const conditions = [];
      if (input?.artigoId) conditions.push(eq(movimentos.artigoId, input.artigoId));
      if (input?.tipo) conditions.push(eq(movimentos.tipo, input.tipo as any));
      if (input?.de) conditions.push(gte(movimentos.dataMovimento, input.de));
      if (input?.ate) conditions.push(lte(movimentos.dataMovimento, input.ate));

      const limite = input?.limite ?? 100;
      const offset = (input?.pagina ?? 0) * limite;

      const baseQuery = db.select({
        movimento: movimentos,
        artigoNome: artigos.nome,
        artigoUnidade: artigos.unidadeBase,
        loteCodigo: lotes.codigoLote,
      }).from(movimentos)
        .leftJoin(artigos, eq(movimentos.artigoId, artigos.id))
        .leftJoin(lotes, eq(movimentos.loteId, lotes.id));

      const items = conditions.length > 0
        ? await baseQuery.where(and(...conditions)).orderBy(desc(movimentos.dataMovimento)).limit(limite).offset(offset)
        : await baseQuery.orderBy(desc(movimentos.dataMovimento)).limit(limite).offset(offset);

      const countQ = conditions.length > 0
        ? await db.select({ count: sql<number>`COUNT(*)` }).from(movimentos).where(and(...conditions))
        : await db.select({ count: sql<number>`COUNT(*)` }).from(movimentos);

      return {
        items: items.map(r => ({ ...r.movimento, artigoNome: r.artigoNome, artigoUnidade: r.artigoUnidade, loteCodigo: r.loteCodigo })),
        total: Number(countQ[0]?.count ?? 0),
      };
    }),

  registarQuebra: protectedProcedure
    .input(z.object({
      artigoId: z.number(),
      quantidade: z.number().positive(),
      motivo: z.string().min(1, "Motivo é obrigatório para quebras"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [artigo] = await db.select().from(artigos).where(eq(artigos.id, input.artigoId)).limit(1);
      if (!artigo) throw new Error("Artigo não encontrado");
      const result = await registarMovimento({
        artigoId: input.artigoId,
        tipo: "quebra",
        quantidade: -input.quantidade,
        custoUnitario: parseFloat(artigo.custoMedioPonderado ?? "0"),
        motivo: input.motivo,
        utilizadorId: ctx.user?.id,
      });
      return result;
    }),

  registarEntradaManual: protectedProcedure
    .input(z.object({
      artigoId: z.number(),
      quantidade: z.number().positive(),
      custoUnitario: z.number().nonnegative(),
      motivo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await registarMovimento({
        artigoId: input.artigoId,
        tipo: "entrada_compra",
        quantidade: input.quantidade,
        custoUnitario: input.custoUnitario,
        motivo: input.motivo,
        utilizadorId: ctx.user?.id,
      });
      return result;
    }),

  registarSaidaManual: protectedProcedure
    .input(z.object({
      artigoId: z.number(),
      quantidade: z.number().positive(),
      motivo: z.string().optional(),
      isWaste: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [artigo] = await db.select().from(artigos).where(eq(artigos.id, input.artigoId)).limit(1);
      if (!artigo) throw new Error("Artigo não encontrado");
      const result = await registarMovimento({
        artigoId: input.artigoId,
        tipo: "quebra",
        quantidade: -input.quantidade,
        custoUnitario: parseFloat(artigo.custoMedioPonderado ?? "0"),
        motivo: input.isWaste ? (input.motivo || "Waste") : (input.motivo ?? "Saída manual"),
        utilizadorId: ctx.user?.id,
      });
      return result;
    }),

  // ─── Estornar movimento (Admin e Head Chef) ───────────────────────────────────
  estornar: roleProcedure(["head_chef"])
    .input(z.object({ id: z.number(), motivo: z.string().min(3, "Indica o motivo do estorno") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      return db.transaction(async (tx) => {
        const [mov] = await tx.select().from(movimentos).where(eq(movimentos.id, input.id)).limit(1);
        if (!mov) throw new Error("Movimento não encontrado");
        if (mov.anuladoEm) throw new Error("Este movimento já foi estornado");
        if (mov.documentoTipo === "estorno") throw new Error("Um movimento de estorno não pode ser estornado diretamente");

        // Reserva a anulação antes de criar o inverso; a transação impede estornos duplicados.
        const reserva = await tx.update(movimentos)
          .set({ anuladoEm: new Date() } as any)
          .where(and(eq(movimentos.id, mov.id), isNull(movimentos.anuladoEm)));
        if ((reserva as any)[0]?.affectedRows !== 1) {
          throw new Error("O movimento foi estornado por outra operação");
        }

        const dadosEstorno = criarDadosEstorno(parseFloat(mov.quantidade), parseFloat(mov.custoUnitario));
        const inverso = await registarMovimento({
          artigoId: mov.artigoId,
          tipo: mov.tipo as any,
          quantidade: dadosEstorno.quantidade,
          custoUnitario: dadosEstorno.custoUnitario,
          documentoId: `estorno_${mov.id}`,
          documentoTipo: "estorno",
          motivo: `Estorno do movimento #${mov.id}: ${input.motivo}`,
          utilizadorId: ctx.user?.id,
          origem: "sistema",
        }, tx as any);

        await tx.update(movimentos)
          .set({ anuladoPorMovimentoId: inverso.movimentoId } as any)
          .where(eq(movimentos.id, mov.id));

        return { success: true, movimentoEstornoId: inverso.movimentoId };
      });
    }),
});
