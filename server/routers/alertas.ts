import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { artigos, fornecedores, notasEncomenda, notasEncomendaLinhas } from "../../drizzle/schema";
import { calcularStockMultiplos } from "../engine/stock";
import { notifyOwner } from "../_core/notification";
import { calcularReposicaoAteMaximo } from "../regras_reposicao_stock";

export const alertasRouter = router({
  verificar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { abaixoMinimo: [], noPontoEncomenda: [], stockNegativo: [] };

    const todosArtigos = await db.select().from(artigos).where(eq(artigos.ativo, true));
    const ids = todosArtigos.map(a => a.id);
    const stockMap = await calcularStockMultiplos(ids);

    const abaixoMinimo = [];
    const noPontoEncomenda = [];
    const stockNegativo = [];

    for (const a of todosArtigos) {
      const stock = stockMap.get(a.id) ?? 0;
      const minimo = parseFloat(a.stockMinimo ?? "0");
      const ponto = parseFloat(a.pontoEncomenda ?? "0");
      const reposicao = calcularReposicaoAteMaximo({
        stockAtual: stock,
        stockMinimo: a.stockMinimo,
        stockMaximo: a.stockMaximo,
        fatorConversao: a.fatorConversao,
        unidadeBase: a.unidadeBase,
        unidadeCompra: a.unidadeCompra,
      });
      if (stock < 0) stockNegativo.push({ ...a, stockAtual: stock });
      else if (stock < minimo) abaixoMinimo.push({ ...a, stockAtual: stock, reposicao });
      else if (ponto > 0 && stock <= ponto) noPontoEncomenda.push({ ...a, stockAtual: stock });
    }

    return { abaixoMinimo, noPontoEncomenda, stockNegativo };
  }),

  gerarNotasEncomenda: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      const todosArtigos = await db.select({
        artigo: artigos,
        fornecedorNome: fornecedores.nome,
        fornecedorEmail: fornecedores.email,
      }).from(artigos)
        .leftJoin(fornecedores, eq(artigos.fornecedorId, fornecedores.id))
        .where(and(eq(artigos.ativo, true), sql`${artigos.fornecedorId} IS NOT NULL`));

      const ids = todosArtigos.map(r => r.artigo.id);
      const stockMap = await calcularStockMultiplos(ids);

      // Agrupar por fornecedor
      const porFornecedor = new Map<number, Array<{ row: typeof todosArtigos[number]; reposicao: NonNullable<ReturnType<typeof calcularReposicaoAteMaximo>> }>>();
      for (const row of todosArtigos) {
        const stock = stockMap.get(row.artigo.id) ?? 0;
        const reposicao = calcularReposicaoAteMaximo({
          stockAtual: stock,
          stockMinimo: row.artigo.stockMinimo,
          stockMaximo: row.artigo.stockMaximo,
          fatorConversao: row.artigo.fatorConversao,
          unidadeBase: row.artigo.unidadeBase,
          unidadeCompra: row.artigo.unidadeCompra,
        });
        if (!reposicao) continue;
        const fId = row.artigo.fornecedorId!;
        if (!porFornecedor.has(fId)) porFornecedor.set(fId, []);
        porFornecedor.get(fId)!.push({ row, reposicao });
      }

      const notasCriadas: number[] = [];
      for (const [fornecedorId, linhas] of Array.from(porFornecedor.entries())) {
        const numero = `NE-${Date.now()}-${fornecedorId}`;
        const [rn] = await db.insert(notasEncomenda).values({
          numero,
          fornecedorId,
          utilizadorId: ctx.user?.id,
        } as any);
        const notaId = (rn as any).insertId as number;

        for (const { row, reposicao } of linhas) {
          const { artigo } = row;
          await db.insert(notasEncomendaLinhas).values({
            notaId,
            artigoId: artigo.id,
            quantidade: reposicao.quantidadeEncomenda.toFixed(3),
            unidade: reposicao.unidadeEncomenda,
            precoEstimado: (parseFloat(artigo.custoMedioPonderado ?? "0") * reposicao.fatorPrecoEstimado).toFixed(6),
          } as any);
        }
        notasCriadas.push(notaId);
      }
      return { notasCriadas };
    }),

  enviarNotificacaoProprietario: protectedProcedure
    .input(z.object({ artigoIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const artList = await db.select().from(artigos)
        .where(sql`${artigos.id} IN (${sql.join(input.artigoIds.map(id => sql`${id}`), sql`, `)})`);
      const stockMap = await calcularStockMultiplos(input.artigoIds);
      const linhas = artList.map(a => {
        const stock = stockMap.get(a.id) ?? 0;
        return `• ${a.nome}: ${stock.toFixed(2)} ${a.unidadeBase} (mínimo: ${parseFloat(a.stockMinimo ?? "0").toFixed(2)} ${a.unidadeBase})`;
      }).join("\n");
      await notifyOwner({
        title: "⚠️ Alerta de Stock Mínimo — Economato",
        content: `Os seguintes artigos estão abaixo do stock mínimo:\n\n${linhas}\n\nVerifique as notas de encomenda pendentes.`,
      });
      return { success: true };
    }),

  listarNotasEncomenda: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      nota: notasEncomenda,
      fornecedorNome: fornecedores.nome,
      fornecedorEmail: fornecedores.email,
    }).from(notasEncomenda)
      .leftJoin(fornecedores, eq(notasEncomenda.fornecedorId, fornecedores.id))
      .orderBy(notasEncomenda.createdAt);
  }),

  obterNotaEncomenda: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [nota] = await db.select().from(notasEncomenda).where(eq(notasEncomenda.id, input.id)).limit(1);
      if (!nota) return null;
      const linhas = await db.select({
        linha: notasEncomendaLinhas,
        artigoNome: artigos.nome,
      }).from(notasEncomendaLinhas)
        .leftJoin(artigos, eq(notasEncomendaLinhas.artigoId, artigos.id))
        .where(eq(notasEncomendaLinhas.notaId, input.id));
      const [forn] = await db.select().from(fornecedores).where(eq(fornecedores.id, nota.fornecedorId)).limit(1);
      return { ...nota, fornecedor: forn, linhas: linhas.map(l => ({ ...l.linha, artigoNome: l.artigoNome })) };
    }),

  aprovarEEnviarNota: protectedProcedure
    .input(z.object({
      id: z.number(),
      dataEntregaPretendida: z.date().optional(),
      linhasAjustadas: z.array(z.object({
        id: z.number(),
        quantidade: z.number(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      if (input.linhasAjustadas) {
        for (const l of input.linhasAjustadas) {
          await db.update(notasEncomendaLinhas).set({ quantidade: l.quantidade.toFixed(3) })
            .where(eq(notasEncomendaLinhas.id, l.id));
        }
      }

      const nota = await (async () => {
        const [n] = await db.select().from(notasEncomenda).where(eq(notasEncomenda.id, input.id)).limit(1);
        return n;
      })();
      if (!nota) throw new Error("Nota de encomenda não encontrada");

      const linhas = await db.select({
        linha: notasEncomendaLinhas,
        artigoNome: artigos.nome,
      }).from(notasEncomendaLinhas)
        .leftJoin(artigos, eq(notasEncomendaLinhas.artigoId, artigos.id))
        .where(eq(notasEncomendaLinhas.notaId, input.id));

      const [forn] = await db.select().from(fornecedores).where(eq(fornecedores.id, nota.fornecedorId)).limit(1);

      // Enviar notificação ao proprietário com a nota de encomenda formatada
      const tabelaLinhas = linhas.map(l =>
        `  ${l.artigoNome ?? "?"}: ${parseFloat(l.linha.quantidade).toFixed(2)} ${l.linha.unidade}`
      ).join("\n");
      const dataEntrega = input.dataEntregaPretendida
        ? input.dataEntregaPretendida.toLocaleDateString("pt-PT")
        : "A definir";

      await notifyOwner({
        title: `📦 Nota de Encomenda ${nota.numero} — ${forn?.nome ?? "Fornecedor"}`,
        content: `**Nota de Encomenda: ${nota.numero}**\n**Fornecedor:** ${forn?.nome ?? "—"}\n**Email:** ${forn?.email ?? "—"}\n**Data de entrega pretendida:** ${dataEntrega}\n\n**Artigos:**\n${tabelaLinhas}\n\nAprovada e enviada ao fornecedor.`,
      });

      await db.update(notasEncomenda).set({
        estado: "enviada",
        enviadaEm: new Date(),
        dataEntregaPretendida: input.dataEntregaPretendida,
      }).where(eq(notasEncomenda.id, input.id));

      return { success: true, fornecedorEmail: forn?.email };
    }),

  marcarRecebida: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.update(notasEncomenda).set({ estado: "recebida", recebidaEm: new Date() })
        .where(eq(notasEncomenda.id, input.id));
      return { success: true };
    }),
});
