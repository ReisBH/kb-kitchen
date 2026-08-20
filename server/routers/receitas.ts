import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { artigos, receitasBaseComponentes, producoes } from "../../drizzle/schema";
import { calcularCustoNos, detetarCiclo, explodirReceita } from "../engine/explosao";
import { registarMovimento, calcularStock, converterParaUnidadeBase } from "../engine/stock";

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
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
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

      // Explodir componentes e dar quebra no stock
      const nos = await explodirReceita(input.receitaId, input.quantidadeProduzida);
      let custoLote = 0;
      for (const no of nos) {
        await registarMovimento({
          artigoId: no.artigoId,
          tipo: "producao_consumo",
          quantidade: -no.quantidade,
          custoUnitario: no.custoUnitario,
          documentoId: `producao_${input.receitaId}_${Date.now()}`,
          documentoTipo: "producao",
          utilizadorId: ctx.user?.id,
        });
        custoLote += no.custoTotal;
      }

      // Criar entrada do subproduto
      const custoUnitarioSubproduto = input.quantidadeProduzida > 0 ? custoLote / input.quantidadeProduzida : 0;
      await registarMovimento({
        artigoId: input.receitaId,
        tipo: "producao_entrada",
        quantidade: input.quantidadeProduzida,
        custoUnitario: custoUnitarioSubproduto,
        documentoTipo: "producao",
        utilizadorId: ctx.user?.id,
      });

      const [r] = await db.insert(producoes).values({
        receitaId: input.receitaId,
        quantidadeProduzida: input.quantidadeProduzida.toFixed(3),
        rendimentoReal: input.quantidadeProduzida.toFixed(3),
        rendimentoEsperado: rendimentoEsperado.toFixed(3),
        desvioPct: desvioPct.toFixed(3),
        custoLote: custoLote.toFixed(4),
        utilizadorId: ctx.user?.id,
      } as any);

      return { id: (r as any).insertId, custoLote, desvioPct };
    }),

  historicoProducoes: protectedProcedure
    .input(z.object({ receitaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(producoes).where(eq(producoes.receitaId, input.receitaId)).orderBy(producoes.createdAt);
    }),
});
