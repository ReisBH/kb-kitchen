import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, roleProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fichasTecnicas, fichasTecnicasComponentes, artigos, vendas, vendaLinhas, movimentos, mapaPos } from "../../drizzle/schema";
import { detetarCiclo, detetarCicloFicha, explodirFicha, calcularCustoFicha, executarExplosaoVenda } from "../engine/explosao";
import { mensagemBloqueioEliminacaoFicha } from "../eliminacao_fichas";
import { validarQuantidadeComercial } from "../regras_venda_fichas";

function removerCustosDaArvore(no: any): any {
  return {
    ...no,
    custoUnitario: 0,
    custoTotal: 0,
    filhos: no.filhos?.map(removerCustosDaArvore),
  };
}

export const fichasRouter = router({
  listar: protectedProcedure
    .input(z.object({ apenasAtivas: z.boolean().default(true), apenasPublicadas: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = db.select().from(fichasTecnicas);
      const condicoes = [];
      if (input?.apenasAtivas !== false) condicoes.push(eq(fichasTecnicas.ativo, true));
      if (input?.apenasPublicadas) condicoes.push(eq(fichasTecnicas.estadoPublicacao, "publicada"));
      const rows = condicoes.length ? await q.where(and(...condicoes)).orderBy(fichasTecnicas.nome) : await q.orderBy(fichasTecnicas.nome);
      // Limitar a concorrência permite carregar listas grandes sem executar 128 árvores de custo em série.
      const result = [];
      const tamanhoLote = 16;
      for (let inicio = 0; inicio < rows.length; inicio += tamanhoLote) {
        const lote = await Promise.all(rows.slice(inicio, inicio + tamanhoLote).map(async (f) => {
          try {
            const custo = await calcularCustoFicha(f.id);
            const preco = parseFloat(f.precoVenda ?? "0");
            const foodCostPct = preco > 0 ? (custo / preco) * 100 : null;
            return { ...f, custoCalculado: custo, foodCostPct };
          } catch {
            return { ...f, custoCalculado: 0, foodCostPct: null };
          }
        }));
        result.push(...lote);
      }
      return result;
    }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const mostrarCustosDetalhados = ["admin", "head_chef", "sub_chefe"].includes(ctx.user.role);
      const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.id)).limit(1);
      if (!ficha) return null;
      const componentesRegistados = await db.select().from(fichasTecnicasComponentes)
        .where(eq(fichasTecnicasComponentes.fichaId, input.id))
        .orderBy(fichasTecnicasComponentes.ordem);
      const componentes = await Promise.all(componentesRegistados.map(async (comp) => {
        if (comp.tipoComponente === "ficha") {
          const [fichaComponente] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, comp.componenteId)).limit(1);
          const custoComponente = fichaComponente ? await calcularCustoFicha(fichaComponente.id) : null;
          return { ...comp, nomeComponente: fichaComponente?.nome ?? "Ficha técnica indisponível", tipoComponente: "ficha_tecnica", tipoReferencia: "ficha" as const, custoComponente, unidadeBase: "dose" };
        }
        const [artigo] = await db.select().from(artigos).where(eq(artigos.id, comp.componenteId)).limit(1);
        return { ...comp, nomeComponente: artigo?.nome ?? "Artigo indisponível", tipoComponente: artigo?.tipo ?? "ingrediente", tipoReferencia: "artigo" as const, custoComponente: artigo?.custoMedioPonderado ?? null, unidadeBase: artigo?.unidadeBase ?? comp.unidade };
      }));
      const arvoreCompleta = await explodirFicha(input.id, 1);
      const custoCalculado = await calcularCustoFicha(input.id);
      const preco = parseFloat(ficha.precoVenda ?? "0");
      const foodCostPct = preco > 0 ? (custoCalculado / preco) * 100 : null;
      return {
        ...ficha,
        componentes: componentes.map(c => ({ ...c, custoComponente: mostrarCustosDetalhados ? c.custoComponente : null })),
        arvore: mostrarCustosDetalhados ? arvoreCompleta : arvoreCompleta.map(removerCustosDaArvore),
        custoCalculado: mostrarCustosDetalhados ? custoCalculado : null,
        foodCostPct: mostrarCustosDetalhados ? foodCostPct : null,
        margemBruta: mostrarCustosDetalhados && preco > 0 ? preco - custoCalculado : null,
      };
    }),

  criar: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      secaoMenu: z.string().optional(),
      familia: z.enum(["Cozinha Quente", "Sushi", "Pastelaria"]),
      precoVenda: z.number().optional(),
      unidadePrecoVenda: z.enum(["dose", "un", "pessoa", "g"]).default("dose"),
      quantidadeMinimaVenda: z.number().positive().optional(),
      foodCostAlvo: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      modoPreparacao: z.string().optional(),
      alergenios: z.number().default(0),
      explodir_receitas: z.enum(["auto", "sempre", "nunca"]).default("auto"),
      componentes: z.array(z.object({
        tipoComponente: z.enum(["artigo", "ficha"]).default("artigo"),
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
        familia: input.familia,
        precoVenda: input.precoVenda?.toFixed(2),
        unidadePrecoVenda: input.unidadePrecoVenda,
        quantidadeMinimaVenda: input.quantidadeMinimaVenda?.toFixed(3),
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
      familia: z.enum(["Cozinha Quente", "Sushi", "Pastelaria"]).optional(),
      precoVenda: z.number().optional(),
      unidadePrecoVenda: z.enum(["dose", "un", "pessoa", "g"]).optional(),
      quantidadeMinimaVenda: z.number().positive().nullable().optional(),
      foodCostAlvo: z.number().optional(),
      tempoPrepMin: z.number().optional(),
      modoPreparacao: z.string().optional(),
      alergenios: z.number().optional(),
      ativo: z.boolean().optional(),
      explodir_receitas: z.enum(["auto", "sempre", "nunca"]).optional(),
      componentes: z.array(z.object({
        tipoComponente: z.enum(["artigo", "ficha"]).default("artigo"),
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
      if (data.quantidadeMinimaVenda !== undefined && data.quantidadeMinimaVenda !== null) updateData.quantidadeMinimaVenda = data.quantidadeMinimaVenda.toFixed(3);
      if (data.foodCostAlvo !== undefined) updateData.foodCostAlvo = data.foodCostAlvo.toFixed(2);
      if (componentes !== undefined || data.precoVenda !== undefined || data.unidadePrecoVenda !== undefined || data.quantidadeMinimaVenda !== undefined || data.modoPreparacao !== undefined) {
        updateData.estadoPublicacao = "em_revisao";
      }
      await db.update(fichasTecnicas).set(updateData).where(eq(fichasTecnicas.id, id));
      if (componentes !== undefined) {
        for (const componente of componentes) {
          if (componente.tipoComponente === "ficha" && await detetarCicloFicha(id, componente.componenteId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Não é permitido criar ciclos entre fichas técnicas." });
          }
        }
        await db.delete(fichasTecnicasComponentes).where(eq(fichasTecnicasComponentes.fichaId, id));
        if (componentes.length > 0) {
          await db.insert(fichasTecnicasComponentes).values(
            componentes.map(c => ({ fichaId: id, ...c, quantidade: c.quantidade.toFixed(4) } as any))
          );
        }
      }
      return { success: true };
    }),

  eliminar: roleProcedure(["admin", "head_chef"])
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.id)).limit(1);
      if (!ficha) throw new TRPCError({ code: "NOT_FOUND", message: "Ficha técnica não encontrada." });
      if (!ficha.ativo) return { success: true, mensagem: "A ficha técnica já se encontrava inativa." };

      const [vendasLigadas] = await db.select({ total: sql<number>`COUNT(*)` }).from(vendaLinhas).where(eq(vendaLinhas.fichaId, input.id));
      const [posLigados] = await db.select({ total: sql<number>`COUNT(*)` }).from(mapaPos).where(eq(mapaPos.fichaId, input.id));
      const bloqueio = mensagemBloqueioEliminacaoFicha({
        linhasVenda: Number(vendasLigadas?.total ?? 0),
        mapeamentosPos: Number(posLigados?.total ?? 0),
      });
      if (bloqueio) throw new TRPCError({ code: "CONFLICT", message: bloqueio });

      // Desativação é preferida à remoção física para preservar auditoria e permitir recuperação controlada.
      await db.update(fichasTecnicas).set({ ativo: false, estadoPublicacao: "rascunho" }).where(eq(fichasTecnicas.id, input.id));
      return { success: true, mensagem: "Ficha técnica desativada e removida da lista ativa." };
    }),

  validarPublicacao: protectedProcedure
    .input(z.object({ fichaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.fichaId)).limit(1);
      if (!ficha) throw new Error("Ficha técnica não encontrada");
      const componentes = await db.select({ total: sql<number>`COUNT(*)` }).from(fichasTecnicasComponentes).where(eq(fichasTecnicasComponentes.fichaId, input.fichaId));
      const erros: string[] = [];
      if (!ficha.ativo) erros.push("A ficha está inativa.");
      if (Number(componentes[0]?.total ?? 0) === 0) erros.push("A ficha não tem componentes.");
      if (parseFloat(ficha.precoVenda ?? "0") <= 0) erros.push("Indica um preço de venda superior a zero.");
      try {
        if (Number(componentes[0]?.total ?? 0) > 0) await calcularCustoFicha(input.fichaId);
      } catch {
        erros.push("Não foi possível calcular o custo da ficha.");
      }
      return { pronta: erros.length === 0, erros };
    }),

  publicar: roleProcedure(["head_chef"])
    .input(z.object({ fichaId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.fichaId)).limit(1);
      if (!ficha) throw new Error("Ficha técnica não encontrada");
      const [componentes] = await db.select({ total: sql<number>`COUNT(*)` }).from(fichasTecnicasComponentes).where(eq(fichasTecnicasComponentes.fichaId, input.fichaId));
      if (!ficha.ativo || Number(componentes?.total ?? 0) === 0 || parseFloat(ficha.precoVenda ?? "0") <= 0) {
        throw new Error("A ficha precisa de estar ativa, ter componentes e preço de venda antes de ser publicada.");
      }
      await db.update(fichasTecnicas).set({ estadoPublicacao: "publicada", publicadaEm: new Date(), publicadaPor: ctx.user?.id }).where(eq(fichasTecnicas.id, input.fichaId));
      return { success: true };
    }),

  registarVenda: protectedProcedure
    .input(z.object({
      data: z.date().optional(),
      linhas: z.array(z.object({
        fichaId: z.number(),
        quantidade: z.number().positive(),
        precoUnitario: z.number().optional(),
        isWaste: z.boolean().default(false),
      })),
      isWaste: z.boolean().default(false),
      idCliente: z.string().min(8).max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const dataVenda = input.data ?? new Date();
      const globalWaste = input.isWaste ?? false;
      const idCliente = input.idCliente ?? randomUUID();
      const stockNegativoGlobal: string[] = [];

      // WASTE mode: explode stock as quebra, no venda record, no food cost impact
      if (globalWaste) {
        const [wasteExistente] = await db.select({ id: movimentos.id }).from(movimentos)
          .where(eq(movimentos.documentoId, `waste_${idCliente}`)).limit(1);
        if (wasteExistente) {
          return { vendaId: null as number | null, custoTotal: 0, totalReceita: 0, foodCostPct: 0, stockNegativo: [], isWaste: true, idempotente: true };
        }
        return db.transaction(async (tx) => {
          for (let indice = 0; indice < input.linhas.length; indice++) {
            const linha = input.linhas[indice];
            const [ficha] = await tx.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, linha.fichaId)).limit(1);
            if (!ficha) continue;
            const { stockNegativo } = await executarExplosaoVenda({
              fichaId: linha.fichaId,
              doses: linha.quantidade,
              vendaId: null,
              utilizadorId: ctx.user?.id,
              comportamento: ficha.explodir_receitas ?? "auto",
              tipoOverride: "quebra",
              motivo: "Waste",
              documentoId: `waste_${idCliente}`,
              idClienteBase: `${idCliente}:linha:${indice}`,
              executor: tx,
            });
            stockNegativoGlobal.push(...stockNegativo);
          }
          return { vendaId: null as number | null, custoTotal: 0, totalReceita: 0, foodCostPct: 0, stockNegativo: stockNegativoGlobal, isWaste: true, idempotente: false };
        });
      }

      const [existente] = await db.select().from(vendas).where(eq(vendas.idCliente, idCliente)).limit(1);
      if (existente) {
        return { vendaId: existente.id, custoTotal: parseFloat(existente.custoTotal ?? "0"), totalReceita: parseFloat(existente.totalReceita ?? "0"), foodCostPct: parseFloat(existente.foodCostPct ?? "0"), stockNegativo: [], isWaste: false, idempotente: true };
      }

      return db.transaction(async (tx) => {
        const [rv] = await tx.insert(vendas).values({ data: dataVenda, origem: "manual", idCliente, utilizadorId: ctx.user?.id } as any);
        const vendaId = (rv as any).insertId as number;
        let custoTotal = 0;
        let totalReceita = 0;
        for (let indice = 0; indice < input.linhas.length; indice++) {
          const linha = input.linhas[indice];
          const [ficha] = await tx.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, linha.fichaId)).limit(1);
          if (!ficha) continue;
          if (!ficha.ativo || ficha.estadoPublicacao !== "publicada") throw new Error(`A ficha “${ficha.nome}” não está publicada para venda.`);
          const erroQuantidade = validarQuantidadeComercial(linha.quantidade, {
            unidadePrecoVenda: ficha.unidadePrecoVenda,
            quantidadeMinimaVenda: ficha.quantidadeMinimaVenda,
          });
          if (erroQuantidade) throw new Error(`${ficha.nome}: ${erroQuantidade}`);
          const { stockNegativo } = await executarExplosaoVenda({ fichaId: linha.fichaId, doses: linha.quantidade, vendaId, utilizadorId: ctx.user?.id, comportamento: ficha.explodir_receitas ?? "auto", idClienteBase: `${idCliente}:linha:${indice}`, executor: tx });
          stockNegativoGlobal.push(...stockNegativo);
          const custoFicha = await calcularCustoFicha(linha.fichaId);
          custoTotal += custoFicha * linha.quantidade;
          const precoUnitario = linha.precoUnitario ?? parseFloat(ficha.precoVenda ?? "0");
          totalReceita += precoUnitario * linha.quantidade;
          await tx.insert(vendaLinhas).values({ vendaId, fichaId: linha.fichaId, quantidade: linha.quantidade.toFixed(3), precoUnitario: precoUnitario.toFixed(2), custoUnitario: custoFicha.toFixed(4) } as any);
        }
        const foodCostPct = totalReceita > 0 ? (custoTotal / totalReceita) * 100 : 0;
        await tx.update(vendas).set({ custoTotal: custoTotal.toFixed(4), totalReceita: totalReceita.toFixed(2), foodCostPct: foodCostPct.toFixed(3), processada: true }).where(eq(vendas.id, vendaId));
        return { vendaId, custoTotal, totalReceita, foodCostPct, stockNegativo: stockNegativoGlobal, isWaste: false, idempotente: false };
      });
    }),

  listarVendas: protectedProcedure
    .input(z.object({ limite: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(vendas).orderBy(vendas.data).limit(input?.limite ?? 30);
    }),
});
