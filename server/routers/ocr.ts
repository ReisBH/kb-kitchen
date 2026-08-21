import { z } from "zod";
import { eq, and, like, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, roleProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { documentosOcr, contasPagar, aliasesFornecedor, mapaPos, artigos, fichasTecnicas, fornecedores, vendas, vendaLinhas } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { converterParaUnidadeBase, registarMovimento } from "../engine/stock";
import { calcularCustoFicha, executarExplosaoVenda } from "../engine/explosao";
import { extrairFaturaComGemini } from "../faturasGemini";
import { calcularEstadoContaPagar } from "../contasPagar";
import { imagemArmazenamentoSchema } from "../ocrInput";

export const ocrRouter = router({
  processarFatura: protectedProcedure
    .input(z.object({
      imagemUrl: imagemArmazenamentoSchema,
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
        const dadosExtraidos = await extrairFaturaComGemini(input.imagemKey);
        const fornecedorEmparelhado = input.fornecedorId ? null : await emparelharFornecedor(dadosExtraidos.fornecedor, dadosExtraidos.nif);
        const fornecedorId = input.fornecedorId ?? fornecedorEmparelhado?.id;

        // Tentar emparelhar linhas com artigos via aliases
        const linhasComEmparelhamento = await Promise.all(
          (dadosExtraidos.linhas ?? []).map(async (linha: any) => {
            const artigoEmparelhado = await emparelharArtigo(linha.descricao, fornecedorId);
            return { ...linha, artigoEmparelhado };
          })
        );
        const dadosComEmparelhamentos = { ...dadosExtraidos, fornecedorEmparelhado, linhas: linhasComEmparelhamento };

        await db.update(documentosOcr).set({
          estado: "em_revisao",
          dadosExtraidos: JSON.stringify(dadosComEmparelhamentos),
          fornecedorId,
          dataDocumento: dadosExtraidos.dataEmissao ? new Date(`${dadosExtraidos.dataEmissao}T12:00:00Z`) : null,
          numeroDocumento: dadosExtraidos.numero,
        }).where(eq(documentosOcr.id, docId));

        return { docId, dadosExtraidos: dadosComEmparelhamentos };
      } catch (err: any) {
        await db.update(documentosOcr).set({ estado: "erro", erroMsg: err.message })
          .where(eq(documentosOcr.id, docId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro na extração: ${err.message}` });
      }
    }),

  processarFechoCaixa: protectedProcedure
    .input(z.object({
      imagemUrl: imagemArmazenamentoSchema,
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
      fornecedorId: z.number().optional(),
      fornecedorNome: z.string().min(1),
      nifFornecedor: z.string().optional(),
      numeroFatura: z.string().optional(),
      dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      condicoesPagamento: z.string().optional(),
      valorTotal: z.number().nonnegative(),
      linhas: z.array(z.object({
        descricao: z.string(),
        artigoId: z.number().optional(),
        quantidade: z.number().nonnegative(),
        unidade: z.string(),
        pesoOuUnidade: z.string().optional(),
        precoPorUnidade: z.number().nonnegative(),
        taxaIva: z.number().nonnegative(),
        valorIva: z.number().nonnegative(),
        valorLinha: z.number().nonnegative(),
        confianca: z.enum(["alta", "media", "baixa"]).default("media"),
        incluir: z.boolean().default(true),
        guardarAlias: z.boolean().default(true),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      return db.transaction(async (tx) => {
        const [doc] = await tx.select().from(documentosOcr).where(eq(documentosOcr.id, input.docId)).limit(1);
        if (!doc) throw new Error("Documento não encontrado");
        if (doc.estado === "confirmado") return { success: true, duplicado: true };
        if (!["em_revisao", "extraido"].includes(doc.estado)) throw new Error("O documento não está pronto para confirmação");

        for (let indice = 0; indice < input.linhas.length; indice++) {
          const linha = input.linhas[indice];
          if (!linha.incluir || !linha.artigoId || linha.quantidade <= 0) continue;
          const [artigo] = await tx.select().from(artigos).where(eq(artigos.id, linha.artigoId)).limit(1);
          if (!artigo) throw new Error(`Artigo ${linha.artigoId} não encontrado`);
          const quantidadeBase = converterParaUnidadeBase(linha.quantidade, linha.unidade, artigo.unidadeBase, parseFloat(artigo.fatorConversao ?? "1"), artigo.densidade ? parseFloat(artigo.densidade) : null);
          if (!Number.isFinite(quantidadeBase) || quantidadeBase <= 0) throw new Error(`Quantidade inválida para “${linha.descricao}”.`);
          const custoUnitarioBase = (linha.precoPorUnidade * linha.quantidade) / quantidadeBase;
          await registarMovimento({
            artigoId: linha.artigoId,
            tipo: "entrada_compra",
            quantidade: quantidadeBase,
            custoUnitario: custoUnitarioBase,
            documentoId: `ocr_${input.docId}`,
            documentoTipo: "fatura",
            origem: "fatura",
            idCliente: `ocr-fatura-${input.docId}:${indice}`,
            utilizadorId: ctx.user?.id,
            dataMovimento: input.dataEmissao ? new Date(`${input.dataEmissao}T12:00:00Z`) : undefined,
          }, tx as any);

          if (linha.guardarAlias) {
            await tx.insert(aliasesFornecedor).values({ fornecedorId: input.fornecedorId ?? doc.fornecedorId, alias: linha.descricao.toUpperCase().trim(), artigoId: linha.artigoId } as any)
              .onDuplicateKeyUpdate({ set: { artigoId: linha.artigoId } });
          }
        }
        const dadosConfirmados = { fornecedor: input.fornecedorNome, nif: input.nifFornecedor, numero: input.numeroFatura, dataEmissao: input.dataEmissao, dataVencimento: input.dataVencimento, condicoesPagamento: input.condicoesPagamento, valorTotal: input.valorTotal, linhas: input.linhas };
        await tx.update(documentosOcr).set({ estado: "confirmado", fornecedorId: input.fornecedorId ?? doc.fornecedorId, dataDocumento: input.dataEmissao ? new Date(`${input.dataEmissao}T12:00:00Z`) : doc.dataDocumento, numeroDocumento: input.numeroFatura ?? doc.numeroDocumento, dadosExtraidos: JSON.stringify(dadosConfirmados) }).where(eq(documentosOcr.id, input.docId));
        await tx.insert(contasPagar).values({ documentoOcrId: input.docId, fornecedorId: input.fornecedorId ?? doc.fornecedorId, fornecedorNome: input.fornecedorNome.trim(), nifFornecedor: input.nifFornecedor?.trim() || null, numeroFatura: input.numeroFatura?.trim() || null, dataEmissao: input.dataEmissao ?? null, dataVencimento: input.dataVencimento ?? null, condicoesPagamento: input.condicoesPagamento?.trim() || null, valorTotal: input.valorTotal.toFixed(2), utilizadorId: ctx.user?.id } as any);
        return { success: true, duplicado: false };
      });
    }),

  listarContasPagar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const contas = await db.select({ conta: contasPagar, fornecedorNomeRegistado: fornecedores.nome }).from(contasPagar)
      .leftJoin(fornecedores, eq(contasPagar.fornecedorId, fornecedores.id))
      .orderBy(contasPagar.dataVencimento);
    return contas.map(({ conta, fornecedorNomeRegistado }) => ({
      ...conta,
      fornecedorNomeApresentacao: fornecedorNomeRegistado ?? conta.fornecedorNome,
      estado: calcularEstadoContaPagar(conta.estadoPagamento, conta.dataVencimento),
    }));
  }),

  marcarContaPaga: roleProcedure(["admin", "head_chef"])
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.update(contasPagar).set({ estadoPagamento: "paga", pagoEm: new Date() }).where(eq(contasPagar.id, input.id));
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
      fichaEstadoPublicacao: fichasTecnicas.estadoPublicacao,
    }).from(mapaPos).leftJoin(fichasTecnicas, eq(mapaPos.fichaId, fichasTecnicas.id));
  }),

  guardarMapaPos: roleProcedure(["head_chef"])
    .input(z.object({ nomePos: z.string(), fichaId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.fichaId)).limit(1);
      if (!ficha?.ativo || ficha.estadoPublicacao !== "publicada") throw new Error("Só podes mapear fichas técnicas ativas e publicadas no POS.");
      await db.insert(mapaPos).values({ ...input, nomePos: input.nomePos.trim(), ativo: true, validadoEm: new Date(), validadoPor: ctx.user?.id } as any)
        .onDuplicateKeyUpdate({ set: { fichaId: input.fichaId, ativo: true, validadoEm: new Date(), validadoPor: ctx.user?.id } });
      return { success: true };
    }),

  desativarMapaPos: roleProcedure(["head_chef"])
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.update(mapaPos).set({ ativo: false }).where(eq(mapaPos.id, input.id));
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
      return db.transaction(async (tx) => {
        const [doc] = await tx.select().from(documentosOcr).where(eq(documentosOcr.id, input.docId)).limit(1);
        if (!doc || doc.tipo !== "fecho_caixa") throw new Error("Fecho de caixa não encontrado");
        if (doc.vendaId) {
          const [existente] = await tx.select().from(vendas).where(eq(vendas.id, doc.vendaId)).limit(1);
          if (existente) return { vendaId: existente.id, custoTotal: parseFloat(existente.custoTotal ?? "0"), totalReceita: parseFloat(existente.totalReceita ?? "0"), foodCostPct: parseFloat(existente.foodCostPct ?? "0"), stockNegativo: [], duplicado: true };
        }
        if (!["em_revisao", "extraido"].includes(doc.estado)) throw new Error("O documento não está pronto para confirmação");

        const [rv] = await tx.insert(vendas).values({ data: new Date(), origem: "ocr_fecho_caixa", documentoOcrId: doc.id, utilizadorId: ctx.user?.id } as any);
        const vendaId = (rv as any).insertId as number;
        let custoTotal = 0;
        let totalReceita = 0;
        const stockNegativo: string[] = [];
        for (let indice = 0; indice < input.linhas.length; indice++) {
          const linha = input.linhas[indice];
          const [ficha] = await tx.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, linha.fichaId)).limit(1);
          if (!ficha) throw new Error(`Ficha técnica ${linha.fichaId} não encontrada`);
          if (!ficha.ativo || ficha.estadoPublicacao !== "publicada") throw new Error(`A ficha “${ficha.nome}” não está publicada para POS.`);
          const { stockNegativo: sn } = await executarExplosaoVenda({ fichaId: linha.fichaId, doses: linha.quantidade, vendaId, utilizadorId: ctx.user?.id, comportamento: ficha.explodir_receitas ?? "auto", idClienteBase: `ocr-caixa-${doc.id}:linha:${indice}`, executor: tx });
          stockNegativo.push(...sn);
          const custoFicha = await calcularCustoFicha(linha.fichaId);
          custoTotal += custoFicha * linha.quantidade;
          totalReceita += linha.valorTotal;
          await tx.insert(vendaLinhas).values({ vendaId, fichaId: linha.fichaId, quantidade: linha.quantidade.toFixed(3), precoUnitario: (linha.valorTotal / linha.quantidade).toFixed(2), custoUnitario: custoFicha.toFixed(4) } as any);
        }
        const foodCostPct = totalReceita > 0 ? (custoTotal / totalReceita) * 100 : 0;
        await tx.update(vendas).set({ custoTotal: custoTotal.toFixed(4), totalReceita: totalReceita.toFixed(2), foodCostPct: foodCostPct.toFixed(3), processada: true }).where(eq(vendas.id, vendaId));
        await tx.update(documentosOcr).set({ estado: "confirmado", vendaId }).where(eq(documentosOcr.id, input.docId));
        return { vendaId, custoTotal, totalReceita, foodCostPct, stockNegativo, duplicado: false };
      });
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

async function emparelharFornecedor(nome: string, nif: string): Promise<{ id: number; nome: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const nifNormalizado = nif.replace(/\D/g, "");
  if (nifNormalizado) {
    const [porNif] = await db.select().from(fornecedores).where(eq(fornecedores.nif, nifNormalizado)).limit(1);
    if (porNif) return { id: porNif.id, nome: porNif.nome };
  }
  const termo = nome.trim().split(/\s+/).find((palavra) => palavra.length > 2);
  if (!termo) return null;
  const [porNome] = await db.select().from(fornecedores).where(like(fornecedores.nome, `%${termo}%`)).limit(1);
  return porNome ? { id: porNome.id, nome: porNome.nome } : null;
}

async function emparelharFicha(nomePos: string): Promise<{ id: number; nome: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const [mapa] = await db.select({ fichaId: mapaPos.fichaId })
    .from(mapaPos).where(and(eq(mapaPos.nomePos, nomePos), eq(mapaPos.ativo, true))).limit(1);
  if (mapa) {
    const [f] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, mapa.fichaId)).limit(1);
    return f?.ativo && f.estadoPublicacao === "publicada" ? { id: f.id, nome: f.nome } : null;
  }
  // Pesquisa aproximada
  const [f] = await db.select().from(fichasTecnicas).where(and(like(fichasTecnicas.nome, `%${nomePos}%`), eq(fichasTecnicas.ativo, true), eq(fichasTecnicas.estadoPublicacao, "publicada"))).limit(1);
  return f ? { id: f.id, nome: f.nome } : null;
}
