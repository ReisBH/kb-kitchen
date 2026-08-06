import { z } from "zod";
import { eq, and, sql, desc, like, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { artigos, movimentos, fornecedores } from "../../drizzle/schema";
import { calcularStockMultiplos } from "../engine/stock";

export const artigosRouter = router({
  listar: protectedProcedure
    .input(z.object({
      tipo: z.enum(["ingrediente", "proteina_limpa", "receita_base"]).optional(),
      categoria: z.string().optional(),
      pesquisa: z.string().optional(),
      apenasAtivos: z.boolean().default(true),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let query = db.select({
        artigo: artigos,
        fornecedorNome: fornecedores.nome,
      }).from(artigos).leftJoin(fornecedores, eq(artigos.fornecedorId, fornecedores.id));

      const conditions = [];
      if (input?.apenasAtivos !== false) conditions.push(eq(artigos.ativo, true));
      if (input?.tipo) conditions.push(eq(artigos.tipo, input.tipo));
      if (input?.categoria) conditions.push(eq(artigos.categoria, input.categoria));
      if (input?.pesquisa) conditions.push(like(artigos.nome, `%${input.pesquisa}%`));

      const rows = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(artigos.nome)
        : await query.orderBy(artigos.nome);

      // Calcular stock atual para todos
      const ids = rows.map(r => r.artigo.id);
      const stockMap = await calcularStockMultiplos(ids);

      return rows.map(r => ({
        ...r.artigo,
        fornecedorNome: r.fornecedorNome,
        stockAtual: stockMap.get(r.artigo.id) ?? 0,
      }));
    }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [a] = await db.select().from(artigos).where(eq(artigos.id, input.id)).limit(1);
      if (!a) return null;
      const { calcularStock } = await import("../engine/stock");
      const stockAtual = await calcularStock(input.id);
      // Histórico de preços (últimas entradas de compra)
      const historico = await db.select()
        .from(movimentos)
        .where(and(eq(movimentos.artigoId, input.id), eq(movimentos.tipo, "entrada_compra")))
        .orderBy(desc(movimentos.dataMovimento))
        .limit(24);
      return { ...a, stockAtual, historicoCustos: historico };
    }),

  criar: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      tipo: z.enum(["ingrediente", "proteina_limpa", "receita_base"]),
      categoria: z.string().optional(),
      unidadeBase: z.string().min(1),
      unidadeCompra: z.string().optional(),
      fatorConversao: z.number().default(1),
      densidade: z.number().optional(),
      stockMinimo: z.number().default(0),
      stockMaximo: z.number().optional(),
      pontoEncomenda: z.number().optional(),
      fornecedorId: z.number().optional(),
      prazoEntregaDias: z.number().default(1),
      perecivel: z.boolean().default(false),
      validadeDias: z.number().optional(),
      alergenios: z.number().default(0),
      rendimentoEsperado: z.number().optional(),
      validadeProducaoDias: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      artigoBrutoId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [r] = await db.insert(artigos).values({
        ...input,
        fatorConversao: input.fatorConversao.toFixed(6),
        stockMinimo: input.stockMinimo.toFixed(3),
        stockMaximo: input.stockMaximo?.toFixed(3),
        pontoEncomenda: input.pontoEncomenda?.toFixed(3),
        densidade: input.densidade?.toFixed(4),
        rendimentoEsperado: input.rendimentoEsperado?.toFixed(3),
      } as any);
      return { id: (r as any).insertId };
    }),

  atualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1).optional(),
      categoria: z.string().optional(),
      unidadeBase: z.string().optional(),
      unidadeCompra: z.string().optional(),
      fatorConversao: z.number().optional(),
      densidade: z.number().optional(),
      stockMinimo: z.number().optional(),
      stockMaximo: z.number().optional(),
      pontoEncomenda: z.number().optional(),
      fornecedorId: z.number().optional().nullable(),
      prazoEntregaDias: z.number().optional(),
      perecivel: z.boolean().optional(),
      validadeDias: z.number().optional(),
      ativo: z.boolean().optional(),
      alergenios: z.number().optional(),
      rendimentoEsperado: z.number().optional(),
      validadeProducaoDias: z.number().optional(),
      tempoPrepMin: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const { id, ...data } = input;
      const updateData: Record<string, any> = { ...data };
      if (data.fatorConversao !== undefined) updateData.fatorConversao = data.fatorConversao.toFixed(6);
      if (data.stockMinimo !== undefined) updateData.stockMinimo = data.stockMinimo.toFixed(3);
      if (data.stockMaximo !== undefined) updateData.stockMaximo = data.stockMaximo.toFixed(3);
      if (data.pontoEncomenda !== undefined) updateData.pontoEncomenda = data.pontoEncomenda.toFixed(3);
      if (data.densidade !== undefined) updateData.densidade = data.densidade.toFixed(4);
      if (data.rendimentoEsperado !== undefined) updateData.rendimentoEsperado = data.rendimentoEsperado.toFixed(3);
      await db.update(artigos).set(updateData).where(eq(artigos.id, id));
      return { success: true };
    }),

  eliminar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.update(artigos).set({ ativo: false }).where(eq(artigos.id, input.id));
      return { success: true };
    }),

  categorias: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.selectDistinct({ categoria: artigos.categoria }).from(artigos).where(sql`${artigos.categoria} IS NOT NULL`);
    return rows.map(r => r.categoria).filter(Boolean) as string[];
  }),
});

