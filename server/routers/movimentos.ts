import { z } from "zod";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { movimentos, artigos } from "../../drizzle/schema";
import { registarMovimento } from "../engine/stock";

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
      }).from(movimentos).leftJoin(artigos, eq(movimentos.artigoId, artigos.id));

      const items = conditions.length > 0
        ? await baseQuery.where(and(...conditions)).orderBy(desc(movimentos.dataMovimento)).limit(limite).offset(offset)
        : await baseQuery.orderBy(desc(movimentos.dataMovimento)).limit(limite).offset(offset);

      const countQ = conditions.length > 0
        ? await db.select({ count: sql<number>`COUNT(*)` }).from(movimentos).where(and(...conditions))
        : await db.select({ count: sql<number>`COUNT(*)` }).from(movimentos);

      return {
        items: items.map(r => ({ ...r.movimento, artigoNome: r.artigoNome, artigoUnidade: r.artigoUnidade })),
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
        motivo: input.motivo ?? "Saída manual",
        utilizadorId: ctx.user?.id,
      });
      return result;
    }),
});
