import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, desc, like, or, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { artigos, movimentos, fornecedores, receitasBaseComponentes, fichasTecnicasComponentes } from "../../drizzle/schema";
import { calcularStockMultiplos } from "../engine/stock";
import { gerarCodigoCurtoSync } from "../utils/codigoCurto";

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
      requerLimpeza: z.boolean().default(false),
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
      // Check for duplicate name (case-insensitive)
      const existing = await db.select({ id: artigos.id, nome: artigos.nome, ativo: artigos.ativo })
        .from(artigos)
        .where(sql`LOWER(${artigos.nome}) = LOWER(${input.nome})`)
        .limit(1);
      if (existing.length > 0) {
        const e = existing[0]!;
        const status = e.ativo ? "activo" : "inactivo";
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe um artigo com o nome "${e.nome}" (${status}). Escolhe um nome diferente ou reactiva o artigo existente.`,
        });
      }
      const [r] = await db.insert(artigos).values({
        ...input,
        fatorConversao: input.fatorConversao.toFixed(6),
        stockMinimo: input.stockMinimo.toFixed(3),
        stockMaximo: input.stockMaximo?.toFixed(3),
        pontoEncomenda: input.pontoEncomenda?.toFixed(3),
        densidade: input.densidade?.toFixed(4),
        rendimentoEsperado: input.rendimentoEsperado?.toFixed(3),
      } as any);
      const newId = (r as any).insertId;
      // Auto-generate unique QR code for the new artigo
      let codigoCurto = gerarCodigoCurtoSync(6);
      for (let i = 0; i < 20; i++) {
        const [ex] = await db.select({ id: artigos.id }).from(artigos).where(eq(artigos.codigoCurto, codigoCurto)).limit(1);
        if (!ex) break;
        codigoCurto = gerarCodigoCurtoSync(6);
      }
      await db.update(artigos).set({ codigoCurto } as any).where(eq(artigos.id, newId));
      return { id: newId, codigoCurto };
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
      requerLimpeza: z.boolean().optional(),
      validadeDias: z.number().optional(),
      ativo: z.boolean().optional(),
      alergenios: z.number().optional(),
      rendimentoEsperado: z.number().optional(),
      validadeProducaoDias: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      tipoEtiqueta: z.enum(["prateleira", "producao", "ambas", "nenhuma"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const { id, ...data } = input;
      // Check for duplicate name on rename (case-insensitive, exclude self)
      if (data.nome) {
        const dupCheck = await db.select({ id: artigos.id, nome: artigos.nome })
          .from(artigos)
          .where(and(sql`LOWER(${artigos.nome}) = LOWER(${data.nome})`, sql`${artigos.id} != ${id}`))
          .limit(1);
        if (dupCheck.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe outro artigo com o nome "${dupCheck[0]!.nome}". Escolhe um nome diferente.`,
          });
        }
      }
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
    const rows = await db.selectDistinct({ categoria: artigos.categoria }).from(artigos).where(sql`${artigos.categoria} IS NOT NULL`).orderBy(artigos.categoria);
    return rows.map(r => r.categoria).filter(Boolean) as string[];
  }),

  // ─── Verificar uso em receitas/fichas (antes de eliminar) ─────────────────────
  verificarUso: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { emUso: false, receitas: [], fichas: [] };
      const emReceitas = await db.select({ receitaId: receitasBaseComponentes.receitaId })
        .from(receitasBaseComponentes)
        .where(eq(receitasBaseComponentes.componenteId, input.id));
      const emFichas = await db.select({ fichaId: fichasTecnicasComponentes.fichaId })
        .from(fichasTecnicasComponentes)
        .where(eq(fichasTecnicasComponentes.componenteId, input.id));
      const receitaIds = Array.from(new Set(emReceitas.map(r => r.receitaId)));
      const fichaIds = Array.from(new Set(emFichas.map(f => f.fichaId)));
      const receitaNomes: string[] = [];
      const fichaNomes: string[] = [];
      if (receitaIds.length > 0) {
        const rows = await db.select({ nome: artigos.nome })
          .from(artigos)
          .where(inArray(artigos.id, receitaIds));
        receitaNomes.push(...rows.map(r => r.nome ?? "—"));
      }
      if (fichaIds.length > 0) {
        const { fichasTecnicas } = await import("../../drizzle/schema");
        const rows = await db.select({ nome: fichasTecnicas.nome })
          .from(fichasTecnicas)
          .where(inArray(fichasTecnicas.id, fichaIds));
        fichaNomes.push(...rows.map(f => f.nome ?? "—"));
      }
      return {
        emUso: receitaNomes.length > 0 || fichaNomes.length > 0,
        receitas: receitaNomes,
        fichas: fichaNomes,
      };
    }),
});
