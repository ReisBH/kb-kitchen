import { z } from "zod";
import { eq, and, like, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { documentosOcr, aliasesFornecedor, mapaPos, artigos, fichasTecnicas, fornecedores, vendas, vendaLinhas } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { registarMovimento } from "../engine/stock";
import { calcularCustoFicha, executarExplosaoVenda } from "../engine/explosao";

export const ocrRouter = router({
  processarFatura: protectedProcedure
    .input(z.object({
      imagemUrl: z.string().url(),
      imagemKey: z.string(),
      fornecedorId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      const [r] = await db.insert(documentosOcr).values({
        tipo: "fatura",
        estado: "pendente",
        imagemUrl: input.imagemUrl,
        imagemKey: input.imagemKey,
        fornecedorId: input.fornecedorId,
        utilizadorId: ctx.user?.id,
      } as any);
      const docId = (r as any).insertId as number;

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `És um assistente especializado em extração de dados de faturas de fornecedores portugueses. Extrai os dados em JSON estrito, sem preâmbulo nem blocos de código markdown. Responde APENAS com o JSON.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: input.imagemUrl, detail: "high" },
                },
                {
                  type: "text",
                  text: `Extrai desta fatura os seguintes dados em JSON:\n{\n  "fornecedor": "nome do fornecedor",\n  "nif": "NIF do fornecedor",\n  "numero": "número do documento",\n  "data": "YYYY-MM-DD",\n  "linhas": [\n    {\n      "descricao": "descrição do artigo",\n      "quantidade": 0.0,\n      "unidade": "kg/un/l/etc",\n      "precoUnitario": 0.00,\n      "totalSemIva": 0.00,\n      "totalComIva": 0.00,\n      "confianca": "alta/media/baixa"\n    }\n  ]\n}`,
                },
              ],
            },
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        let dadosExtraidos: any;
        try {
          dadosExtraidos = JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          dadosExtraidos = match ? JSON.parse(match[0]) : {};
        }

        // Tentar emparelhar linhas com artigos via aliases
        const linhasComEmparelhamento = await Promise.all(
          (dadosExtraidos.linhas ?? []).map(async (linha: any) => {
            const artigoEmparelhado = await emparelharArtigo(linha.descricao, input.fornecedorId);
            return { ...linha, artigoEmparelhado };
          })
        );
        dadosExtraidos.linhas = linhasComEmparelhamento;

        await db.update(documentosOcr).set({
          estado: "em_revisao",
          dadosExtraidos: JSON.stringify(dadosExtraidos),
          dataDocumento: dadosExtraidos.data ? new Date(dadosExtraidos.data) : null,
          numeroDocumento: dadosExtraidos.numero,
        }).where(eq(documentosOcr.id, docId));

        return { docId, dadosExtraidos };
      } catch (err: any) {
        await db.update(documentosOcr).set({ estado: "erro", erroMsg: err.message })
          .where(eq(documentosOcr.id, docId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro na extração: ${err.message}` });
      }
    }),

  processarFechoCaixa: protectedProcedure
    .input(z.object({
      imagemUrl: z.string().url(),
      imagemKey: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");

      const [r] = await db.insert(documentosOcr).values({
        tipo: "fecho_caixa",
        estado: "pendente",
        imagemUrl: input.imagemUrl,
        imagemKey: input.imagemKey,
        utilizadorId: ctx.user?.id,
      } as any);
      const docId = (r as any).insertId as number;

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `És um assistente especializado em extração de dados de mapas de vendas/fechos de caixa de restaurantes portugueses. Extrai os dados em JSON estrito.`,
            },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: input.imagemUrl, detail: "high" } },
                {
                  type: "text",
                  text: `Extrai deste mapa de vendas/fecho de caixa:\n{\n  "data": "YYYY-MM-DD",\n  "totalReceita": 0.00,\n  "linhas": [\n    {\n      "nomeItem": "nome do prato/item",\n      "quantidade": 0,\n      "valorTotal": 0.00,\n      "confianca": "alta/media/baixa"\n    }\n  ]\n}`,
                },
              ],
            },
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        let dadosExtraidos: any;
        try {
          dadosExtraidos = JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          dadosExtraidos = match ? JSON.parse(match[0]) : {};
        }

        // Emparelhar com fichas técnicas via mapa POS
        const linhasComEmparelhamento = await Promise.all(
          (dadosExtraidos.linhas ?? []).map(async (linha: any) => {
            const fichaEmparelhada = await emparelharFicha(linha.nomeItem);
            return { ...linha, fichaEmparelhada };
          })
        );
        dadosExtraidos.linhas = linhasComEmparelhamento;

        await db.update(documentosOcr).set({
          estado: "em_revisao",
          dadosExtraidos: JSON.stringify(dadosExtraidos),
          dataDocumento: dadosExtraidos.data ? new Date(dadosExtraidos.data) : null,
        }).where(eq(documentosOcr.id, docId));

        return { docId, dadosExtraidos };
      } catch (err: any) {
        await db.update(documentosOcr).set({ estado: "erro", erroMsg: err.message })
          .where(eq(documentosOcr.id, docId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro na extração: ${err.message}` });
      }
    }),

  confirmarFatura: protectedProcedure
    .input(z.object({
      docId: z.number(),
      linhas: z.array(z.object({
        descricao: z.string(),
        artigoId: z.number(),
        quantidade: z.number().positive(),
        unidade: z.string(),
        precoUnitario: z.number().nonnegative(),
        guardarAlias: z.boolean().default(true),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [doc] = await db.select().from(documentosOcr).where(eq(documentosOcr.id, input.docId)).limit(1);
      if (!doc) throw new Error("Documento não encontrado");

      for (const linha of input.linhas) {
        const [artigo] = await db.select().from(artigos).where(eq(artigos.id, linha.artigoId)).limit(1);
        if (!artigo) continue;

        // Verificar variação de preço > 15%
        const custoAtual = parseFloat(artigo.custoMedioPonderado ?? "0");
        if (custoAtual > 0) {
          const variacao = Math.abs((linha.precoUnitario - custoAtual) / custoAtual) * 100;
          // Variação registada nos dados extraídos para alerta na UI
        }

        await registarMovimento({
          artigoId: linha.artigoId,
          tipo: "entrada_compra",
          quantidade: linha.quantidade,
          custoUnitario: linha.precoUnitario,
          documentoId: `ocr_${input.docId}`,
          documentoTipo: "fatura",
          utilizadorId: ctx.user?.id,
        });

        if (linha.guardarAlias) {
          await db.insert(aliasesFornecedor).values({
            fornecedorId: doc.fornecedorId,
            alias: linha.descricao.toUpperCase().trim(),
            artigoId: linha.artigoId,
          } as any).onDuplicateKeyUpdate({ set: { artigoId: linha.artigoId } });
        }
      }

      await db.update(documentosOcr).set({ estado: "confirmado" }).where(eq(documentosOcr.id, input.docId));
      return { success: true };
    }),

  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(documentosOcr).orderBy(documentosOcr.createdAt);
  }),

  listarAliases: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      alias: aliasesFornecedor,
      artigoNome: artigos.nome,
      fornecedorNome: fornecedores.nome,
    }).from(aliasesFornecedor)
      .leftJoin(artigos, eq(aliasesFornecedor.artigoId, artigos.id))
      .leftJoin(fornecedores, eq(aliasesFornecedor.fornecedorId, fornecedores.id));
  }),

  listarMapaPos: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      mapa: mapaPos,
      fichaNome: fichasTecnicas.nome,
    }).from(mapaPos).leftJoin(fichasTecnicas, eq(mapaPos.fichaId, fichasTecnicas.id));
  }),

  guardarMapaPos: protectedProcedure
    .input(z.object({ nomePos: z.string(), fichaId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.insert(mapaPos).values(input as any).onDuplicateKeyUpdate({ set: { fichaId: input.fichaId } });
      return { success: true };
    }),

  confirmarFechoCaixa: protectedProcedure
    .input(z.object({
      docId: z.number(),
      linhas: z.array(z.object({
        nomeItem: z.string(),
        fichaId: z.number(),
        quantidade: z.number().positive(),
        valorTotal: z.number().nonnegative(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [rv] = await db.insert(vendas).values({
        data: new Date(),
        origem: "ocr_fecho_caixa",
        utilizadorId: ctx.user?.id,
      } as any);
      const vendaId = (rv as any).insertId as number;
      let custoTotal = 0;
      let totalReceita = 0;
      const stockNegativo: string[] = [];
      for (const linha of input.linhas) {
        const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, linha.fichaId)).limit(1);
        if (!ficha) continue;
        const { stockNegativo: sn } = await executarExplosaoVenda({
          fichaId: linha.fichaId,
          doses: linha.quantidade,
          vendaId,
          utilizadorId: ctx.user?.id,
          comportamento: ficha.explodir_receitas ?? "auto",
        });
        stockNegativo.push(...sn);
        const custoFicha = await calcularCustoFicha(linha.fichaId);
        custoTotal += custoFicha * linha.quantidade;
        totalReceita += linha.valorTotal;
        await db.insert(vendaLinhas).values({
          vendaId,
          fichaId: linha.fichaId,
          quantidade: linha.quantidade.toFixed(3),
          precoUnitario: (linha.valorTotal / linha.quantidade).toFixed(2),
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
      await db.update(documentosOcr).set({ estado: "confirmado" }).where(eq(documentosOcr.id, input.docId));
      return { vendaId, custoTotal, totalReceita, foodCostPct, stockNegativo };
    }),
});

async function emparelharArtigo(descricao: string, fornecedorId?: number): Promise<{ id: number; nome: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const aliasNorm = descricao.toUpperCase().trim();
  // 1. Alias exato
  const [alias] = await db.select({ artigoId: aliasesFornecedor.artigoId })
    .from(aliasesFornecedor)
    .where(and(eq(aliasesFornecedor.alias, aliasNorm), fornecedorId ? eq(aliasesFornecedor.fornecedorId, fornecedorId) : eq(aliasesFornecedor.fornecedorId, aliasesFornecedor.fornecedorId)))
    .limit(1);
  if (alias) {
    const [a] = await db.select().from(artigos).where(eq(artigos.id, alias.artigoId)).limit(1);
    return a ? { id: a.id, nome: a.nome } : null;
  }
  // 2. Pesquisa por nome aproximado
  const palavras = descricao.split(" ").filter(p => p.length > 3).slice(0, 3);
  for (const palavra of palavras) {
    const [a] = await db.select().from(artigos).where(like(artigos.nome, `%${palavra}%`)).limit(1);
    if (a) return { id: a.id, nome: a.nome };
  }
  return null;
}

async function emparelharFicha(nomePos: string): Promise<{ id: number; nome: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const [mapa] = await db.select({ fichaId: mapaPos.fichaId })
    .from(mapaPos).where(eq(mapaPos.nomePos, nomePos)).limit(1);
  if (mapa) {
    const [f] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, mapa.fichaId)).limit(1);
    return f ? { id: f.id, nome: f.nome } : null;
  }
  // Pesquisa aproximada
  const [f] = await db.select().from(fichasTecnicas).where(like(fichasTecnicas.nome, `%${nomePos}%`)).limit(1);
  return f ? { id: f.id, nome: f.nome } : null;
}
