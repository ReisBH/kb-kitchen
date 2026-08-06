/**
 * Motor de stock — cálculo de custo médio ponderado e movimentos
 * Todas as operações de stock passam por aqui.
 */
import { and, eq, sql, desc } from "drizzle-orm";
import { getDb } from "../db";
import { movimentos, artigos, type InsertMovimento } from "../../drizzle/schema";

export type TipoMovimento =
  | "entrada_compra"
  | "producao_consumo"
  | "producao_entrada"
  | "venda_consumo"
  | "quebra"
  | "transformacao_saida"
  | "transformacao_entrada"
  | "ajuste_inventario";

/** Calcula o stock atual de um artigo somando todos os movimentos */
export async function calcularStock(artigoId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(${movimentos.quantidade}), 0)` })
    .from(movimentos)
    .where(eq(movimentos.artigoId, artigoId));
  return parseFloat(result[0]?.total ?? "0");
}

/** Calcula o stock de múltiplos artigos de uma vez */
export async function calcularStockMultiplos(artigoIds: number[]): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");
  if (artigoIds.length === 0) return new Map();
  const result = await db
    .select({
      artigoId: movimentos.artigoId,
      total: sql<string>`COALESCE(SUM(${movimentos.quantidade}), 0)`,
    })
    .from(movimentos)
    .where(sql`${movimentos.artigoId} IN (${sql.join(artigoIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(movimentos.artigoId);
  const map = new Map<number, number>();
  for (const row of result) {
    map.set(row.artigoId, parseFloat(row.total));
  }
  return map;
}

/** Regista um movimento e atualiza o custo médio ponderado do artigo */
export async function registarMovimento(input: {
  artigoId: number;
  tipo: TipoMovimento;
  quantidade: number; // positivo = entrada, negativo = saída
  custoUnitario: number;
  documentoId?: string;
  documentoTipo?: string;
  motivo?: string;
  utilizadorId?: number;
  dataMovimento?: Date;
}): Promise<{ movimentoId: number; stockApos: number; custoMedioApos: number }> {
  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  // Buscar artigo atual
  const [artigo] = await db.select().from(artigos).where(eq(artigos.id, input.artigoId)).limit(1);
  if (!artigo) throw new Error(`Artigo ${input.artigoId} não encontrado`);

  const stockAtual = await calcularStock(input.artigoId);
  const custoAtual = parseFloat(artigo.custoMedioPonderado ?? "0");

  // Calcular novo custo médio ponderado (só para entradas)
  let novoCusto = custoAtual;
  if (input.quantidade > 0) {
    const totalValorAtual = stockAtual * custoAtual;
    const totalValorEntrada = input.quantidade * input.custoUnitario;
    const novoStock = stockAtual + input.quantidade;
    novoCusto = novoStock > 0 ? (totalValorAtual + totalValorEntrada) / novoStock : input.custoUnitario;
  }

  const stockApos = stockAtual + input.quantidade;

  // Inserir movimento
  const [result] = await db.insert(movimentos).values({
    artigoId: input.artigoId,
    tipo: input.tipo,
    quantidade: input.quantidade.toFixed(3),
    custoUnitario: input.custoUnitario.toFixed(6),
    custoMedioApos: novoCusto.toFixed(6),
    stockApos: stockApos.toFixed(3),
    documentoId: input.documentoId,
    documentoTipo: input.documentoTipo,
    motivo: input.motivo,
    utilizadorId: input.utilizadorId,
    dataMovimento: input.dataMovimento ?? new Date(),
  } as InsertMovimento);

  const movimentoId = (result as any).insertId as number;

  // Atualizar custo médio ponderado no artigo (só para entradas)
  if (input.quantidade > 0) {
    await db.update(artigos)
      .set({ custoMedioPonderado: novoCusto.toFixed(6) })
      .where(eq(artigos.id, input.artigoId));
  }

  return { movimentoId, stockApos, custoMedioApos: novoCusto };
}

/** Converte uma quantidade de uma unidade para a unidade base do artigo */
export function converterParaUnidadeBase(
  quantidade: number,
  unidadeOrigem: string,
  unidadeBase: string,
  fatorConversao: number,
  densidade?: number | null
): number {
  if (unidadeOrigem === unidadeBase) return quantidade;

  // Conversão por fator direto (ex: caixa → g)
  if (fatorConversao && fatorConversao !== 1) {
    return quantidade * fatorConversao;
  }

  // Conversão peso ↔ volume via densidade
  const pesoUnidades = ["g", "kg"];
  const volumeUnidades = ["ml", "l", "cl", "dl"];
  const isPesoOrigem = pesoUnidades.includes(unidadeOrigem.toLowerCase());
  const isVolumeOrigem = volumeUnidades.includes(unidadeOrigem.toLowerCase());
  const isPesoBase = pesoUnidades.includes(unidadeBase.toLowerCase());
  const isVolumeBase = volumeUnidades.includes(unidadeBase.toLowerCase());

  // Normalizar para unidade SI (g ou ml)
  let qtdSI = quantidade;
  if (unidadeOrigem.toLowerCase() === "kg") qtdSI = quantidade * 1000;
  else if (unidadeOrigem.toLowerCase() === "l") qtdSI = quantidade * 1000;
  else if (unidadeOrigem.toLowerCase() === "cl") qtdSI = quantidade * 10;
  else if (unidadeOrigem.toLowerCase() === "dl") qtdSI = quantidade * 100;

  if ((isPesoOrigem && isVolumeBase) || (isVolumeOrigem && isPesoBase)) {
    if (!densidade) {
      throw new Error(
        `Conversão de ${unidadeOrigem} para ${unidadeBase} requer densidade definida no artigo`
      );
    }
    if (isPesoOrigem) qtdSI = qtdSI / densidade; // g → ml
    else qtdSI = qtdSI * densidade; // ml → g
  }

  // Converter para unidade base
  if (unidadeBase.toLowerCase() === "kg") return qtdSI / 1000;
  if (unidadeBase.toLowerCase() === "l") return qtdSI / 1000;
  if (unidadeBase.toLowerCase() === "cl") return qtdSI / 10;
  if (unidadeBase.toLowerCase() === "dl") return qtdSI / 100;

  return qtdSI;
}
