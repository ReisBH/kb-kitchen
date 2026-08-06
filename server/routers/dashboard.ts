import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { artigos, movimentos, vendas, inventarios } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { calcularStockMultiplos } from "../engine/stock";

export const dashboardRouter = router({
  resumo: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todosArtigos = await db.select().from(artigos).where(eq(artigos.ativo, true));
    const ids = todosArtigos.map(a => a.id);
    const stockMap = await calcularStockMultiplos(ids);

    let valorTotalStock = 0;
    const abaixoMinimo: typeof todosArtigos = [];
    const stockNegativo: typeof todosArtigos = [];

    for (const a of todosArtigos) {
      const stock = stockMap.get(a.id) ?? 0;
      const custo = parseFloat(a.custoMedioPonderado ?? "0");
      valorTotalStock += stock * custo;
      if (stock < 0) stockNegativo.push(a);
      else if (stock < parseFloat(a.stockMinimo ?? "0")) abaixoMinimo.push(a);
    }

    // Food cost do dia
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vendasHoje = await db.select().from(vendas)
      .where(and(gte(vendas.data, hoje), eq(vendas.processada, true)));
    const custoHoje = vendasHoje.reduce((acc, v) => acc + parseFloat(v.custoTotal ?? "0"), 0);
    const receitaHoje = vendasHoje.reduce((acc, v) => acc + parseFloat(v.totalReceita ?? "0"), 0);
    const foodCostHoje = receitaHoje > 0 ? (custoHoje / receitaHoje) * 100 : null;

    // Movimentos recentes
    const movimentosRecentes = await db.select({
      movimento: movimentos,
      artigoNome: artigos.nome,
    }).from(movimentos)
      .leftJoin(artigos, eq(movimentos.artigoId, artigos.id))
      .orderBy(desc(movimentos.dataMovimento))
      .limit(10);

    // Evolução do food cost (últimos 30 dias)
    const ha30Dias = new Date();
    ha30Dias.setDate(ha30Dias.getDate() - 30);
    const vendasMes = await db.select().from(vendas)
      .where(and(gte(vendas.data, ha30Dias), eq(vendas.processada, true)))
      .orderBy(vendas.data);

    return {
      valorTotalStock,
      totalArtigos: todosArtigos.length,
      abaixoMinimo: abaixoMinimo.map(a => ({ ...a, stockAtual: stockMap.get(a.id) ?? 0 })),
      stockNegativo: stockNegativo.map(a => ({ ...a, stockAtual: stockMap.get(a.id) ?? 0 })),
      foodCostHoje,
      custoHoje,
      receitaHoje,
      movimentosRecentes: movimentosRecentes.map(r => ({ ...r.movimento, artigoNome: r.artigoNome })),
      evolucaoFoodCost: vendasMes.map(v => ({
        data: v.data,
        foodCostPct: parseFloat(v.foodCostPct ?? "0"),
        receita: parseFloat(v.totalReceita ?? "0"),
      })),
    };
  }),
});

