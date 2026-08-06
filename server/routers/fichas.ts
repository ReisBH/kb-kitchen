import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fichasTecnicas, fichasTecnicasComponentes, artigos, vendas, vendaLinhas } from "../../drizzle/schema";
import { detetarCiclo, explodirFicha, calcularCustoFicha, executarExplosaoVenda } from "../engine/explosao";

export const fichasRouter = router({
  listar: protectedProcedure
    .input(z.object({ apenasAtivas: z.boolean().default(true) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = db.select().from(fichasTecnicas);
      const rows = input?.apenasAtivas !== false
        ? await q.where(sql`${fichasTecnicas.ativo} = 1`).orderBy(fichasTecnicas.nome)
        : await q.orderBy(fichasTecnicas.nome);
      // Calcular custo de cada ficha
      const result = [];
      for (const f of rows) {
        try {
          const custo = await calcularCustoFicha(f.id);
          const preco = parseFloat(f.precoVenda ?? "0");
          const foodCostPct = preco > 0 ? (custo / preco) * 100 : null;
          result.push({ ...f, custoCalculado: custo, foodCostPct });
        } catch {
          result.push({ ...f, custoCalculado: 0, foodCostPct: null });
        }
      }
      return result;
    }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.id)).limit(1);
      if (!ficha) return null;
      const componentes = await db.select({
        comp: fichasTecnicasComponentes,
        nomeComponente: artigos.nome,
        tipoComponente: artigos.tipo,
        custoComponente: artigos.custoMedioPonderado,
        unidadeBase: artigos.unidadeBase,
      }).from(fichasTecnicasComponentes)
        .leftJoin(artigos, eq(fichasTecnicasComponentes.componenteId, artigos.id))
        .where(eq(fichasTecnicasComponentes.fichaId, input.id))
        .orderBy(fichasTecnicasComponentes.ordem);
      const arvore = await explodirFicha(input.id, 1);
      const custoCalculado = arvore.reduce((acc, n) => acc + n.custoTotal, 0);
      const preco = parseFloat(ficha.precoVenda ?? "0");
      const foodCostPct = preco > 0 ? (custoCalculado / preco) * 100 : null;
      return {
        ...ficha,
        componentes: componentes.map(c => ({ ...c.comp, nomeComponente: c.nomeComponente, tipoComponente: c.tipoComponente, custoComponente: c.custoComponente, unidadeBase: c.unidadeBase })),
        arvore,
        custoCalculado,
        foodCostPct,
        margemBruta: preco > 0 ? preco - custoCalculado : null,
      };
    }),

  criar: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      secaoMenu: z.string().optional(),
      precoVenda: z.number().optional(),
      foodCostAlvo: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      modoPreparacao: z.string().optional(),
      alergenios: z.number().default(0),
      explodir_receitas: z.enum(["auto", "sempre", "nunca"]).default("auto"),
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
      const [r] = await db.insert(fichasTecnicas).values({
        nome: input.nome,
        descricao: input.descricao,
        secaoMenu: input.secaoMenu,
        precoVenda: input.precoVenda?.toFixed(2),
        foodCostAlvo: input.foodCostAlvo?.toFixed(2),
        tempoPrepMin: input.tempoPrepMin,
        modoPreparacao: input.modoPreparacao,
        alergenios: input.alergenios,
        explodir_receitas: input.explodir_receitas,
      } as any);
      const fichaId = (r as any).insertId as number;
      if (input.componentes.length > 0) {
        await db.insert(fichasTecnicasComponentes).values(
          input.componentes.map(c => ({ fichaId, ...c, quantidade: c.quantidade.toFixed(4) } as any))
        );
      }
      return { id: fichaId };
    }),

  atualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().optional(),
      descricao: z.string().optional(),
      secaoMenu: z.string().optional(),
      precoVenda: z.number().optional(),
      foodCostAlvo: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      modoPreparacao: z.string().optional(),
      alergenios: z.number().optional(),
      ativo: z.boolean().optional(),
      explodir_receitas: z.enum(["auto", "sempre", "nunca"]).optional(),
      componentes: z.array(z.object({
        componenteId: z.number(),
        quantidade: z.number().positive(),
        unidade: z.string(),
        ordem: z.number().default(0),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const { id, componentes, ...data } = input;
      const updateData: Record<string, any> = { ...data };
      if (data.precoVenda !== undefined) updateData.precoVenda = data.precoVenda.toFixed(2);
      if (data.foodCostAlvo !== undefined) updateData.foodCostAlvo = data.foodCostAlvo.toFixed(2);
      await db.update(fichasTecnicas).set(updateData).where(eq(fichasTecnicas.id, id));
      if (componentes !== undefined) {
        await db.delete(fichasTecnicasComponentes).where(eq(fichasTecnicasComponentes.fichaId, id));
        if (componentes.length > 0) {
          await db.insert(fichasTecnicasComponentes).values(
            componentes.map(c => ({ fichaId: id, ...c, quantidade: c.quantidade.toFixed(4) } as any))
          );
        }
      }
      return { success: true };
    }),

  registarVenda: protectedProcedure
    .input(z.object({
      data: z.date().optional(),
      linhas: z.array(z.object({
        fichaId: z.number(),
        quantidade: z.number().positive(),
        precoUnitario: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const dataVenda = input.data ?? new Date();

      // Criar registo de venda
      const [rv] = await db.insert(vendas).values({
        data: dataVenda,
        origem: "manual",
        utilizadorId: ctx.user?.id,
      } as any);
      const vendaId = (rv as any).insertId as number;

      let custoTotal = 0;
      let totalReceita = 0;
      const stockNegativoGlobal: string[] = [];

      for (const linha of input.linhas) {
        const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, linha.fichaId)).limit(1);
        if (!ficha) continue;

        const { stockNegativo } = await executarExplosaoVenda({
          fichaId: linha.fichaId,
          doses: linha.quantidade,
          vendaId,
          utilizadorId: ctx.user?.id,
          comportamento: ficha.explodir_receitas ?? "auto",
        });
        stockNegativoGlobal.push(...stockNegativo);

        const custoFicha = await calcularCustoFicha(linha.fichaId);
        const custoLinha = custoFicha * linha.quantidade;
        custoTotal += custoLinha;
        const precoLinha = (linha.precoUnitario ?? parseFloat(ficha.precoVenda ?? "0")) * linha.quantidade;
        totalReceita += precoLinha;

        await db.insert(vendaLinhas).values({
          vendaId,
          fichaId: linha.fichaId,
          quantidade: linha.quantidade.toFixed(3),
          precoUnitario: (linha.precoUnitario ?? parseFloat(ficha.precoVenda ?? "0")).toFixed(2),
          custoUnitario: custoFicha.toFixed(4),
        } as any);
      }

      const foodCostPct = totalReceita > 0 ? (custoTotal / totalReceita) * 100 : 0;
      await db.update(vendas).set({
        custoTotal: custoTotal.toFixed(4),
        totalReceita: totalReceita.toFixed(2),
        foodCostPct: foodCostPct.toFixed(3),
        processada: true,
      }).where(eq(vendas.id, vendaId));

      return { vendaId, custoTotal, totalReceita, foodCostPct, stockNegativo: stockNegativoGlobal };
    }),

  listarVendas: protectedProcedure
    .input(z.object({ limite: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(vendas).orderBy(vendas.data).limit(input?.limite ?? 30);
    }),
});
