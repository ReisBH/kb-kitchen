import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, roleProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { artigos, receitasBaseComponentes, producoes, lotes, aprovacoesOperacionais } from "../../drizzle/schema";
import { calcularCustoNos, detetarCiclo, explodirReceita } from "../engine/explosao";
import { registarMovimento, calcularStock, converterParaUnidadeBase } from "../engine/stock";
import { gerarCodigoLoteSync } from "../utils/codigoCurto";

const METODOS_CONSERVACAO = ["vacuo", "refrigerado", "congelado", "ambiente"] as const;

export function podeDecidirAprovacao(solicitadoPor: number, decisorId: number) {
  return solicitadoPor !== decisorId;
}

export const receitasRouter = router({
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(artigos).where(and(eq(artigos.tipo, "receita_base"), eq(artigos.ativo, true))).orderBy(artigos.nome);
  }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const mostrarCustosDetalhados = ["admin", "head_chef", "sub_chefe"].includes(ctx.user.role);
      const [receita] = await db.select().from(artigos).where(eq(artigos.id, input.id)).limit(1);
      if (!receita) return null;
      const componentes = await db.select({
        comp: receitasBaseComponentes,
        nomeComponente: artigos.nome,
        tipoComponente: artigos.tipo,
        custoComponente: artigos.custoMedioPonderado,
        unidadeBase: artigos.unidadeBase,
        fatorConversao: artigos.fatorConversao,
        densidade: artigos.densidade,
      }).from(receitasBaseComponentes)
        .leftJoin(artigos, eq(receitasBaseComponentes.componenteId, artigos.id))
        .where(eq(receitasBaseComponentes.receitaId, input.id))
        .orderBy(receitasBaseComponentes.ordem);
      const stockAtual = await calcularStock(input.id);
      const componentesComCusto = componentes.map((c) => {
        const quantidadeBase = converterParaUnidadeBase(
          parseFloat(c.comp.quantidade),
          c.comp.unidade,
          c.unidadeBase ?? "g",
          parseFloat(c.fatorConversao ?? "1"),
          c.densidade ? parseFloat(c.densidade) : null,
        );
        const custoComponente = parseFloat(c.custoComponente ?? "0");
        const custoTotal = quantidadeBase * custoComponente;
        return {
          ...c.comp,
          nomeComponente: c.nomeComponente,
          tipoComponente: c.tipoComponente,
          custoComponente: mostrarCustosDetalhados ? c.custoComponente : null,
          custoTotal: mostrarCustosDetalhados ? custoTotal : null,
          unidadeBase: c.unidadeBase,
        };
      });
      return { ...receita, componentes: componentesComCusto, stockAtual };
    }),

  custo: protectedProcedure
    .input(z.object({ id: z.number(), quantidade: z.number().default(1) }))
    .query(async ({ input }) => {
      const nos = await explodirReceita(input.id, input.quantidade);
      return { nos, custoTotal: calcularCustoNos(nos) };
    }),

  criar: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      categoria: z.string().optional(),
      familia: z.enum(["Cozinha Quente", "Sushi", "Pastelaria"]),
      unidadeBase: z.string().min(1),
      rendimentoEsperado: z.number().positive(),
      validadeProducaoDias: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      componentes: z.array(z.object({
        componenteId: z.number(),
        quantidade: z.number().positive(),
        unidade: z.string(),
        ordem: z.number().default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      // Criar artigo do tipo receita_base
      const [r] = await db.insert(artigos).values({
        nome: input.nome,
        tipo: "receita_base",
        categoria: input.categoria,
        familia: input.familia,
        unidadeBase: input.unidadeBase,
        rendimentoEsperado: input.rendimentoEsperado.toFixed(3),
        validadeProducaoDias: input.validadeProducaoDias,
        tempoPrepMin: input.tempoPrepMin,
      } as any);
      const receitaId = (r as any).insertId as number;

      // Verificar ciclos e inserir componentes
      for (const comp of input.componentes) {
        const temCiclo = await detetarCiclo(receitaId, comp.componenteId);
        if (temCiclo) {
          await db.delete(artigos).where(eq(artigos.id, receitaId));
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ciclo detetado: o componente ${comp.componenteId} criaria uma dependência circular` });
        }
      }
      if (input.componentes.length > 0) {
        await db.insert(receitasBaseComponentes).values(
          input.componentes.map(c => ({ receitaId, ...c, quantidade: c.quantidade.toFixed(4) } as any))
        );
      }
      return { id: receitaId };
    }),

  atualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1),
      familia: z.enum(["Cozinha Quente", "Sushi", "Pastelaria"]),
      unidadeBase: z.string().min(1),
      rendimentoEsperado: z.number().min(0),
      validadeProducaoDias: z.number().nullable().optional(),
      tempoPrepMin: z.number().nullable().optional(),
      componentes: z.array(z.object({
        componenteId: z.number(),
        quantidade: z.number().positive(),
        unidade: z.string(),
        ordem: z.number().default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      for (const comp of input.componentes) {
        const temCiclo = await detetarCiclo(input.id, comp.componenteId);
        if (temCiclo) throw new TRPCError({ code: "BAD_REQUEST", message: "Ciclo detetado: dependência circular" });
      }
      await db.update(artigos).set({
        nome: input.nome,
        familia: input.familia,
        unidadeBase: input.unidadeBase,
        rendimentoEsperado: input.rendimentoEsperado.toFixed(3),
        validadeProducaoDias: input.validadeProducaoDias ?? null,
        tempoPrepMin: input.tempoPrepMin ?? null,
      } as any).where(and(eq(artigos.id, input.id), eq(artigos.tipo, "receita_base")));
      await db.delete(receitasBaseComponentes).where(eq(receitasBaseComponentes.receitaId, input.id));
      if (input.componentes.length) await db.insert(receitasBaseComponentes).values(input.componentes.map((comp) => ({ receitaId: input.id, ...comp, quantidade: comp.quantidade.toFixed(4) } as any)));
      return { success: true };
    }),

  atualizarComponentes: protectedProcedure
    .input(z.object({
      id: z.number(),
      componentes: z.array(z.object({
        componenteId: z.number(),
        quantidade: z.number().positive(),
        unidade: z.string(),
        ordem: z.number().default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      // Verificar ciclos
      for (const comp of input.componentes) {
        const temCiclo = await detetarCiclo(input.id, comp.componenteId);
        if (temCiclo) throw new TRPCError({ code: "BAD_REQUEST", message: `Ciclo detetado: dependência circular` });
      }
      await db.delete(receitasBaseComponentes).where(eq(receitasBaseComponentes.receitaId, input.id));
      if (input.componentes.length > 0) {
        await db.insert(receitasBaseComponentes).values(
          input.componentes.map(c => ({ receitaId: input.id, ...c, quantidade: c.quantidade.toFixed(4) } as any))
        );
      }
      return { success: true };
    }),

  registarProducao: protectedProcedure
    .input(z.object({
      receitaId: z.number(),
      quantidadeProduzida: z.number().positive(),
      metodoConservacao: z.enum(METODOS_CONSERVACAO).default("refrigerado"),
      notas: z.string().max(1000).optional(),
      idCliente: z.string().min(8).max(64),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [existente] = await db.select().from(producoes).where(eq(producoes.idCliente, input.idCliente)).limit(1);
      if (existente) return { id: existente.id, estado: existente.estado, custoLote: Number(existente.custoLote ?? 0), desvioPct: Number(existente.desvioPct ?? 0), idempotente: true };
      const [receita] = await db.select().from(artigos).where(eq(artigos.id, input.receitaId)).limit(1);
      if (!receita) throw new Error("Receita não encontrada");

      const rendimentoEsperado = parseFloat(receita.rendimentoEsperado ?? "0");
      if (rendimentoEsperado <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Preencha o rendimento esperado da receita antes de registar produção, para calcular corretamente o custo.",
        });
      }
      const desvioPct = rendimentoEsperado > 0
        ? ((input.quantidadeProduzida - rendimentoEsperado) / rendimentoEsperado) * 100
        : 0;
      const nos = await explodirReceita(input.receitaId, input.quantidadeProduzida);
      const custoPrevisto = nos.reduce((total, no) => total + no.custoTotal, 0);
      const dataValidade = receita.validadeProducaoDias == null ? null : new Date(Date.now() + Number(receita.validadeProducaoDias) * 86400000).toISOString().slice(0, 10);
      return db.transaction(async (tx) => {
        const [r] = await tx.insert(producoes).values({
          receitaId: input.receitaId,
          estado: "pendente_aprovacao",
          idCliente: input.idCliente,
          quantidadeProduzida: input.quantidadeProduzida.toFixed(3),
          rendimentoReal: input.quantidadeProduzida.toFixed(3),
          rendimentoEsperado: rendimentoEsperado.toFixed(3),
          desvioPct: desvioPct.toFixed(3),
          custoLote: custoPrevisto.toFixed(4),
          metodoConservacao: input.metodoConservacao,
          dataValidade,
          notas: input.notas,
          utilizadorId: ctx.user!.id,
        } as any);
        const producaoId = Number((r as any).insertId);
        await tx.insert(aprovacoesOperacionais).values({ tipo: "producao", entidadeId: producaoId, estado: "pendente", solicitadoPor: ctx.user!.id, motivo: input.notas ?? null } as any);
        return { id: producaoId, estado: "pendente_aprovacao" as const, custoLote: custoPrevisto, desvioPct, idempotente: false };
      });
    }),

  listarAprovacoesPendentes: roleProcedure(["head_chef"])
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select({ aprovacao: aprovacoesOperacionais, producao: producoes, receitaNome: artigos.nome, solicitante: aprovacoesOperacionais.solicitadoPor })
        .from(aprovacoesOperacionais)
        .innerJoin(producoes, and(eq(aprovacoesOperacionais.tipo, "producao"), eq(aprovacoesOperacionais.entidadeId, producoes.id)))
        .innerJoin(artigos, eq(producoes.receitaId, artigos.id))
        .where(eq(aprovacoesOperacionais.estado, "pendente"))
        .orderBy(desc(aprovacoesOperacionais.createdAt));
    }),

  decidirProducao: roleProcedure(["head_chef"])
    .input(z.object({ producaoId: z.number(), aprovar: z.boolean(), motivo: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      return db.transaction(async (tx) => {
        const [aprovacao] = await tx.select().from(aprovacoesOperacionais).where(and(eq(aprovacoesOperacionais.tipo, "producao"), eq(aprovacoesOperacionais.entidadeId, input.producaoId))).limit(1);
        if (!aprovacao || aprovacao.estado !== "pendente") throw new TRPCError({ code: "CONFLICT", message: "Este pedido já foi decidido ou não existe." });
        if (!podeDecidirAprovacao(aprovacao.solicitadoPor, ctx.user!.id)) throw new TRPCError({ code: "FORBIDDEN", message: "O solicitante não pode aprovar a própria produção." });
        const [producao] = await tx.select().from(producoes).where(eq(producoes.id, input.producaoId)).limit(1);
        if (!producao || producao.estado !== "pendente_aprovacao") throw new TRPCError({ code: "CONFLICT", message: "A produção já não está pendente." });
        if (!input.aprovar) {
          if (!input.motivo?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Indica o motivo da rejeição." });
          await tx.update(producoes).set({ estado: "rejeitada" }).where(eq(producoes.id, producao.id));
          await tx.update(aprovacoesOperacionais).set({ estado: "rejeitada", decididoPor: ctx.user!.id, decisaoMotivo: input.motivo ?? null, decididoEm: new Date() }).where(eq(aprovacoesOperacionais.id, aprovacao.id));
          return { success: true, estado: "rejeitada" as const };
        }
        const [receita] = await tx.select().from(artigos).where(eq(artigos.id, producao.receitaId)).limit(1);
        if (!receita) throw new TRPCError({ code: "NOT_FOUND", message: "Receita base não encontrada." });
        const nos = await explodirReceita(producao.receitaId, Number(producao.quantidadeProduzida));
        let codigoLote = gerarCodigoLoteSync(8);
        for (let tentativa = 0; tentativa < 10; tentativa++) {
          const [existente] = await tx.select({ id: lotes.id }).from(lotes).where(eq(lotes.codigoLote, codigoLote)).limit(1);
          if (!existente) break;
          codigoLote = gerarCodigoLoteSync(8);
        }
        const [loteCriado] = await tx.insert(lotes).values({
          codigoLote, artigoId: producao.receitaId, quantidadeProduzida: producao.quantidadeProduzida,
          quantidadeRestante: producao.quantidadeProduzida, unidade: receita.unidadeBase,
          dataValidade: producao.dataValidade, metodoConservacao: producao.metodoConservacao!,
          utilizadorId: producao.utilizadorId, producaoId: producao.id,
          ingredientesUsados: JSON.stringify(nos.map(no => ({ artigoId: no.artigoId, quantidade: no.quantidade }))), notas: producao.notas,
        } as any);
        const loteId = Number((loteCriado as any).insertId);
        const documentoId = `producao_${producao.id}`;
        let custoLote = 0;
        for (let indice = 0; indice < nos.length; indice++) {
          const no = nos[indice];
          await registarMovimento({ artigoId: no.artigoId, tipo: "producao_consumo", quantidade: -no.quantidade, custoUnitario: no.custoUnitario, documentoId, documentoTipo: "producao", motivo: `Produção ${codigoLote}`, utilizadorId: ctx.user!.id, origem: "producao", idCliente: `producao-${producao.id}-consumo-${indice}` }, tx as any);
          custoLote += no.custoTotal;
        }
        const custoUnitario = custoLote / Number(producao.quantidadeProduzida);
        await registarMovimento({ artigoId: producao.receitaId, loteId, tipo: "producao_entrada", quantidade: Number(producao.quantidadeProduzida), custoUnitario, documentoId, documentoTipo: "producao", motivo: `Entrada do lote ${codigoLote}`, utilizadorId: ctx.user!.id, origem: "producao", idCliente: `producao-${producao.id}-entrada` }, tx as any);
        await tx.update(producoes).set({ estado: "aprovada", loteId, custoLote: custoLote.toFixed(4) }).where(eq(producoes.id, producao.id));
        await tx.update(aprovacoesOperacionais).set({ estado: "aprovada", decididoPor: ctx.user!.id, decisaoMotivo: input.motivo ?? null, decididoEm: new Date() }).where(eq(aprovacoesOperacionais.id, aprovacao.id));
        return { success: true, estado: "aprovada" as const, loteId, codigoLote, custoLote };
      });
    }),

  historicoProducoes: protectedProcedure
    .input(z.object({ receitaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(producoes).where(eq(producoes.receitaId, input.receitaId)).orderBy(producoes.createdAt);
    }),
});
