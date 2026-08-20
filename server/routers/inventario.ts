import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { protectedProcedure, router, roleProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { inventarios, inventarioLinhas, artigos, aprovacoesOperacionais } from "../../drizzle/schema";
import { calcularStock, calcularStockMultiplos, registarMovimento } from "../engine/stock";

export function requerAprovacaoInventario(linhas: Array<{ desvioPct: string | null; desvioQtd: string | null }>) {
  return linhas.some((linha) => Math.abs(parseFloat(linha.desvioPct ?? "0")) > 5 && Math.abs(parseFloat(linha.desvioQtd ?? "0")) > 0.001);
}

export const inventarioRouter = router({
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(inventarios).orderBy(inventarios.createdAt);
  }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [inv] = await db.select().from(inventarios).where(eq(inventarios.id, input.id)).limit(1);
      if (!inv) return null;
      const linhas = await db.select({
        linha: inventarioLinhas,
        artigoNome: artigos.nome,
        artigoUnidade: artigos.unidadeBase,
        artigo: artigos,
      }).from(inventarioLinhas)
        .leftJoin(artigos, eq(inventarioLinhas.artigoId, artigos.id))
        .where(eq(inventarioLinhas.inventarioId, input.id));
      return { ...inv, linhas: linhas.map(l => ({ ...l.linha, artigoNome: l.artigoNome, artigoUnidade: l.artigoUnidade })) };
    }),

  iniciar: protectedProcedure
    .input(z.object({
      nome: z.string().optional(),
      zona: z.string().optional(),
      artigoIds: z.array(z.number()).optional(),
      idCliente: z.string().min(8).max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const idCliente = input.idCliente;
      if (idCliente) {
        const [existente] = await db.select().from(inventarios).where(eq(inventarios.idCliente, idCliente)).limit(1);
        if (existente) return { id: existente.id, duplicado: true };
      }
      return db.transaction(async (tx) => {
        const [r] = await tx.insert(inventarios).values({ nome: input.nome ?? `Inventário ${new Date().toLocaleDateString("pt-PT")}`, zona: input.zona, idCliente, utilizadorId: ctx.user?.id } as any);
        const inventarioId = (r as any).insertId as number;
        const artList = input.artigoIds
          ? await tx.select().from(artigos).where(sql`${artigos.id} IN (${sql.join(input.artigoIds.map(id => sql`${id}`), sql`, `)})`)
          : await tx.select().from(artigos).where(eq(artigos.ativo, true));
        const stockMap = await calcularStockMultiplos(artList.map(a => a.id), tx as any);
        if (artList.length > 0) {
          await tx.insert(inventarioLinhas).values(artList.map(a => ({ inventarioId, artigoId: a.id, stockTeorico: (stockMap.get(a.id) ?? 0).toFixed(3) } as any)));
        }
        return { id: inventarioId, duplicado: false };
      });
    }),

  registarContagem: protectedProcedure
    .input(z.object({
      inventarioId: z.number(),
      linhas: z.array(z.object({
        artigoId: z.number(),
        stockReal: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      for (const l of input.linhas) {
        const [linha] = await db.select().from(inventarioLinhas)
          .where(and(eq(inventarioLinhas.inventarioId, input.inventarioId), eq(inventarioLinhas.artigoId, l.artigoId)))
          .limit(1);
        if (!linha) continue;
        const teorico = parseFloat(linha.stockTeorico ?? "0");
        const desvioQtd = l.stockReal - teorico;
        const [artigo] = await db.select().from(artigos).where(eq(artigos.id, l.artigoId)).limit(1);
        const custo = parseFloat(artigo?.custoMedioPonderado ?? "0");
        const desvioValor = desvioQtd * custo;
        const desvioPct = teorico !== 0 ? (desvioQtd / teorico) * 100 : 0;
        await db.update(inventarioLinhas).set({
          stockReal: l.stockReal.toFixed(3),
          desvioQtd: desvioQtd.toFixed(3),
          desvioValor: desvioValor.toFixed(4),
          desvioPct: desvioPct.toFixed(3),
        }).where(and(eq(inventarioLinhas.inventarioId, input.inventarioId), eq(inventarioLinhas.artigoId, l.artigoId)));
      }
      return { success: true };
    }),

  fechar: protectedProcedure
    .input(z.object({ inventarioId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [inventarioAtual] = await db.select().from(inventarios).where(eq(inventarios.id, input.inventarioId)).limit(1);
      if (!inventarioAtual) throw new Error("Inventário não encontrado");
      if (inventarioAtual.estado === "fechado") return { success: true, duplicado: true, pendenteAprovacao: false };
      if (inventarioAtual.estado === "pendente_aprovacao") return { success: true, duplicado: true, pendenteAprovacao: true };
      const contagens = await db.select().from(inventarioLinhas).where(and(eq(inventarioLinhas.inventarioId, input.inventarioId), sql`${inventarioLinhas.stockReal} IS NOT NULL`));
      const temDesvioCritico = requerAprovacaoInventario(contagens);
      if (temDesvioCritico) {
        await db.transaction(async (tx) => {
          await tx.update(inventarios).set({ estado: "pendente_aprovacao" }).where(eq(inventarios.id, input.inventarioId));
          await tx.insert(aprovacoesOperacionais).values({ tipo: "inventario", entidadeId: input.inventarioId, estado: "pendente", solicitadoPor: ctx.user!.id, motivo: "Inventário com desvio superior a 5%; requer segunda aprovação antes de ajustar stock." } as any)
            .onDuplicateKeyUpdate({ set: { estado: "pendente", solicitadoPor: ctx.user!.id, motivo: "Inventário reenviado com desvio crítico para aprovação.", decididoPor: null, decisaoMotivo: null, decididoEm: null } });
        });
        return { success: true, duplicado: false, pendenteAprovacao: true };
      }
      return db.transaction(async (tx) => {
        const [inventario] = await tx.select().from(inventarios).where(eq(inventarios.id, input.inventarioId)).limit(1);
        if (!inventario) throw new Error("Inventário não encontrado");
        if (inventario.estado === "fechado") return { success: true, duplicado: true };
        const linhas = await tx.select({ linha: inventarioLinhas, artigo: artigos }).from(inventarioLinhas)
          .leftJoin(artigos, eq(inventarioLinhas.artigoId, artigos.id))
          .where(and(eq(inventarioLinhas.inventarioId, input.inventarioId), sql`${inventarioLinhas.stockReal} IS NOT NULL`, isNull(inventarioLinhas.ajusteMovimentoId)));
        for (const { linha, artigo } of linhas) {
          if (!artigo) continue;
          const desvio = parseFloat(linha.desvioQtd ?? "0");
          if (Math.abs(desvio) < 0.001) continue;
          const { movimentoId } = await registarMovimento({ artigoId: artigo.id, tipo: "ajuste_inventario", quantidade: desvio, custoUnitario: parseFloat(artigo.custoMedioPonderado ?? "0"), documentoId: `inventario_${input.inventarioId}`, documentoTipo: "inventario", motivo: `Ajuste de inventário #${input.inventarioId}`, origem: "inventario", idCliente: `inventario-${input.inventarioId}:linha-${linha.id}`, utilizadorId: ctx.user?.id }, tx as any);
          await tx.update(inventarioLinhas).set({ ajusteMovimentoId: movimentoId }).where(eq(inventarioLinhas.id, linha.id));
        }
        await tx.update(inventarios).set({ estado: "fechado", fechadoEm: new Date() }).where(eq(inventarios.id, input.inventarioId));
        return { success: true, duplicado: false, pendenteAprovacao: false };
      });
    }),

  listarAprovacoesPendentes: roleProcedure(["head_chef"])
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select({ aprovacao: aprovacoesOperacionais, inventario: inventarios })
        .from(aprovacoesOperacionais)
        .innerJoin(inventarios, and(eq(aprovacoesOperacionais.tipo, "inventario"), eq(aprovacoesOperacionais.entidadeId, inventarios.id)))
        .where(eq(aprovacoesOperacionais.estado, "pendente"));
    }),

  decidirAprovacao: roleProcedure(["head_chef"])
    .input(z.object({ inventarioId: z.number(), aprovar: z.boolean(), motivo: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      return db.transaction(async (tx) => {
        const [aprovacao] = await tx.select().from(aprovacoesOperacionais).where(and(eq(aprovacoesOperacionais.tipo, "inventario"), eq(aprovacoesOperacionais.entidadeId, input.inventarioId))).limit(1);
        if (!aprovacao || aprovacao.estado !== "pendente") throw new Error("Este inventário não tem aprovação pendente.");
        if (aprovacao.solicitadoPor === ctx.user!.id) throw new Error("O solicitante não pode aprovar o próprio inventário.");
        const [inventario] = await tx.select().from(inventarios).where(eq(inventarios.id, input.inventarioId)).limit(1);
        if (!inventario || inventario.estado !== "pendente_aprovacao") throw new Error("O inventário já não está pendente de aprovação.");
        if (!input.aprovar) {
          if (!input.motivo?.trim()) throw new Error("Indica o motivo da rejeição.");
          await tx.update(inventarios).set({ estado: "em_curso" }).where(eq(inventarios.id, inventario.id));
          await tx.update(aprovacoesOperacionais).set({ estado: "rejeitada", decididoPor: ctx.user!.id, decisaoMotivo: input.motivo, decididoEm: new Date() }).where(eq(aprovacoesOperacionais.id, aprovacao.id));
          return { success: true, estado: "rejeitada" as const };
        }
        const linhas = await tx.select({ linha: inventarioLinhas, artigo: artigos }).from(inventarioLinhas).leftJoin(artigos, eq(inventarioLinhas.artigoId, artigos.id)).where(and(eq(inventarioLinhas.inventarioId, inventario.id), sql`${inventarioLinhas.stockReal} IS NOT NULL`, isNull(inventarioLinhas.ajusteMovimentoId)));
        for (const { linha, artigo } of linhas) {
          if (!artigo) continue;
          const desvio = parseFloat(linha.desvioQtd ?? "0");
          if (Math.abs(desvio) < 0.001) continue;
          const { movimentoId } = await registarMovimento({ artigoId: artigo.id, tipo: "ajuste_inventario", quantidade: desvio, custoUnitario: parseFloat(artigo.custoMedioPonderado ?? "0"), documentoId: `inventario_${inventario.id}`, documentoTipo: "inventario", motivo: `Ajuste de inventário #${inventario.id} aprovado`, origem: "inventario", idCliente: `inventario-${inventario.id}:linha-${linha.id}`, utilizadorId: ctx.user!.id }, tx as any);
          await tx.update(inventarioLinhas).set({ ajusteMovimentoId: movimentoId }).where(eq(inventarioLinhas.id, linha.id));
        }
        await tx.update(inventarios).set({ estado: "fechado", fechadoEm: new Date() }).where(eq(inventarios.id, inventario.id));
        await tx.update(aprovacoesOperacionais).set({ estado: "aprovada", decididoPor: ctx.user!.id, decisaoMotivo: input.motivo ?? null, decididoEm: new Date() }).where(eq(aprovacoesOperacionais.id, aprovacao.id));
        return { success: true, estado: "aprovada" as const };
      });
    }),

  // ─── Verificar desvios antes de fechar (retorna desvios >5%) ─────────────────
  verificarDesvios: protectedProcedure
    .input(z.object({ inventarioId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { desvios: [], temDesviosSignificativos: false };
      const linhas = await db.select({
        linha: inventarioLinhas,
        artigoNome: artigos.nome,
        artigoUnidade: artigos.unidadeBase,
      }).from(inventarioLinhas)
        .leftJoin(artigos, eq(inventarioLinhas.artigoId, artigos.id))
        .where(and(
          eq(inventarioLinhas.inventarioId, input.inventarioId),
          sql`${inventarioLinhas.stockReal} IS NOT NULL`
        ));
      const desviosSignificativos = linhas
        .filter(l => {
          const pct = Math.abs(parseFloat(l.linha.desvioPct ?? "0"));
          const qtd = Math.abs(parseFloat(l.linha.desvioQtd ?? "0"));
          return pct > 5 && qtd > 0.001;
        })
        .map(l => ({
          artigoId: l.linha.artigoId,
          artigoNome: l.artigoNome ?? "—",
          artigoUnidade: l.artigoUnidade ?? "g",
          stockTeorico: parseFloat(l.linha.stockTeorico ?? "0"),
          stockReal: parseFloat(l.linha.stockReal ?? "0"),
          desvioQtd: parseFloat(l.linha.desvioQtd ?? "0"),
          desvioPct: parseFloat(l.linha.desvioPct ?? "0"),
          desvioValor: parseFloat(l.linha.desvioValor ?? "0"),
        }))
        .sort((a, b) => Math.abs(b.desvioPct) - Math.abs(a.desvioPct));
      return {
        desvios: desviosSignificativos,
        temDesviosSignificativos: desviosSignificativos.length > 0,
      };
    }),

  // ─── Editar inventário (Admin e Head Chef) ────────────────────────────────────
  editar: roleProcedure(["head_chef"]).input(z.object({
    id: z.number(),
    nome: z.string().optional(),
    zona: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Base de dados não disponível");
    await db.update(inventarios).set({
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.zona !== undefined ? { zona: input.zona } : {}),
    }).where(eq(inventarios.id, input.id));
    return { success: true };
  }),

  // ─── Eliminar inventário em curso (Admin e Head Chef) ─────────────────────────
  // Um inventário fechado mantém o registo e os ajustes; estes são operações auditáveis.
  eliminar: roleProcedure(["head_chef"]).input(z.object({
    id: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Base de dados não disponível");
    const [inventario] = await db.select().from(inventarios).where(eq(inventarios.id, input.id)).limit(1);
    if (!inventario) throw new Error("Inventário não encontrado");
    if (inventario.estado === "fechado") throw new Error("Inventários fechados não podem ser eliminados; usa estorno nos ajustes necessários.");
    await db.delete(inventarioLinhas).where(eq(inventarioLinhas.inventarioId, input.id));
    await db.delete(inventarios).where(eq(inventarios.id, input.id));
    return { success: true };
  }),
});
